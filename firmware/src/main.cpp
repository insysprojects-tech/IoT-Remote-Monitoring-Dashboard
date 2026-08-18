#define TINY_GSM_MODEM_SIM7600
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>

#define SerialMon Serial
#define SerialAT Serial1
#define MODEM_RX_PIN 17
#define MODEM_TX_PIN 18
#define MODEM_PWRKEY_PIN 4

const char apn[] = "jionet";

// --- EMQX Cloud Settings ---
const char* mqtt_server = "j18eff7a.ala.asia-southeast1.emqxsl.com";
const int mqtt_port = 8883;
const char* mqtt_username = "test1";
const char* mqtt_password = "test1";
const char* mqtt_topic = "test/devices/{MAC_ADDRESS}/power";
const char* mqtt_client_id = "ESP32-SIM7670-Dashboard";

TinyGsm modem(SerialAT);

// --- Sensor Pins ---
const int BATTERY_PIN = 7, VOLTAGE_SENSOR_2_PIN = 6, HW122_1_VOUT_PIN = 5, HW122_2_VOUT_PIN = 8;
float R1 = 30000, R2 = 7500, calibration_factor = 1.0245;

// Base interval of 3 seconds (3000 ms)
const unsigned long BASE_INTERVAL = 3000; 
unsigned long lastPublishTime = 0;
long currentJitter = 0;

// Helper: send AT command and print response for debugging
bool sendATCommand(const char* cmd, const char* expectedResp, unsigned long timeout = 5000) {
  SerialAT.println(cmd);
  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeout) {
    while (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
    }
    if (response.indexOf(expectedResp) != -1) {
      Serial.print("  >> "); Serial.println(response);
      return true;
    }
    if (response.indexOf("ERROR") != -1) {
      Serial.print("  >> ERROR: "); Serial.println(response);
      return false;
    }
  }
  Serial.print("  >> TIMEOUT: "); Serial.println(response);
  return false;
}

void powerOn() {
  Serial.println("\n[Power] Powering on modem...");
  pinMode(MODEM_PWRKEY_PIN, OUTPUT);
  digitalWrite(MODEM_PWRKEY_PIN, LOW); delay(100);
  digitalWrite(MODEM_PWRKEY_PIN, HIGH); delay(1000);
  digitalWrite(MODEM_PWRKEY_PIN, LOW);
  Serial.println("[Power] Waiting 8 seconds for modem boot...");
  delay(8000);
}

bool connectNetwork() {
  Serial.println("[Net] Initializing SerialAT...");
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);

  Serial.print("[Net] Waiting for AT response");
  while (!modem.testAT()) { Serial.print("."); delay(1000); }
  Serial.println(" OK!");

  Serial.println("[Net] Initializing modem...");
  modem.init();

  // Set default EPS bearer APN for Jio
  Serial.println("[Net] Setting EPS bearer APN...");
  modem.sendAT(GF("+CGDCONT=1,\"IP\",\"jionet\""));
  modem.waitResponse();

  // LTE only mode
  Serial.println("[Net] Setting LTE-only mode...");
  modem.setNetworkMode(38);

  Serial.println("[Net] Waiting for network (up to 3 mins)...");
  if (!modem.waitForNetwork(180000L, true)) {
    Serial.println("[Net] ERROR: Network registration failed.");
    return false;
  }
  Serial.println("[Net] Network registered!");

  Serial.println("[Net] Activating PDP context for data...");
  // For native MQTT, the modem manages its own data connection.
  // We activate PDP context manually with AT commands.
  modem.sendAT(GF("+CGACT=1,1"));
  if (modem.waitResponse(30000L) != 1) {
    Serial.println("[Net] WARNING: PDP activation returned non-OK, trying GPRS fallback...");
    if (!modem.gprsConnect(apn, "", "")) {
      Serial.println("[Net] WARNING: GPRS also failed, continuing anyway for native MQTT...");
    }
  }
  
  // Check what IP we got
  modem.sendAT(GF("+CGPADDR=1"));
  modem.waitResponse();
  
  Serial.print("[Net] Local IP: ");
  Serial.println(modem.getLocalIP());
  Serial.println("[Net] Network setup complete!");
  return true;
}

bool connectMQTT() {
  Serial.println("\n[MQTT] Setting up modem's native MQTT client over SSL...");

  // Full cleanup of any previous MQTT session
  Serial.println("[MQTT] Cleaning up previous sessions...");
  sendATCommand("AT+CMQTTDISC=0,60", "OK", 5000);
  delay(500);
  sendATCommand("AT+CMQTTREL=0", "OK", 3000);
  delay(500);
  sendATCommand("AT+CMQTTSTOP", "OK", 5000);
  delay(2000);

  // Configure SSL: TLS 1.2, no certificate verification
  Serial.println("[MQTT] Configuring SSL...");
  sendATCommand("AT+CSSLCFG=\"sslversion\",0,4", "OK", 3000);
  sendATCommand("AT+CSSLCFG=\"authmode\",0,0", "OK", 3000);
  sendATCommand("AT+CSSLCFG=\"enableSNI\",0,1", "OK", 3000);

  // Start MQTT service
  Serial.println("[MQTT] Starting MQTT service...");
  if (!sendATCommand("AT+CMQTTSTART", "+CMQTTSTART: 0", 10000)) {
    Serial.println("[MQTT] WARNING: CMQTTSTART may have already been started.");
  }
  delay(1000);

  // Acquire client with SSL enabled (servertype=1 for SSL)
  // Use a short, simple client ID to avoid issues
  Serial.println("[MQTT] Acquiring MQTT client (SSL mode)...");
  if (!sendATCommand("AT+CMQTTACCQ=0,\"ESP32Client\",1", "OK", 5000)) {
    Serial.println("[MQTT] Retrying without SSL flag...");
    if (!sendATCommand("AT+CMQTTACCQ=0,\"ESP32Client\"", "OK", 5000)) {
      Serial.println("[MQTT] ERROR: CMQTTACCQ failed completely.");
      return false;
    }
  }
  delay(500);

  // Set SSL context for MQTT
  Serial.println("[MQTT] Linking SSL config to MQTT...");
  sendATCommand("AT+CMQTTSSLCFG=0,0", "OK", 3000);
  delay(500);

  // Connect to EMQX broker with username/password
  Serial.println("[MQTT] Connecting to EMQX broker...");
  char connCmd[256];
  snprintf(connCmd, sizeof(connCmd),
           "AT+CMQTTCONNECT=0,\"tcp://%s:%d\",60,1,\"%s\",\"%s\"",
           mqtt_server, mqtt_port, mqtt_username, mqtt_password);
  if (!sendATCommand(connCmd, "+CMQTTCONNECT: 0,0", 30000)) {
    Serial.println("[MQTT] ERROR: CMQTTCONNECT failed.");
    return false;
  }

  Serial.println("[MQTT] Connected to EMQX successfully!");
  return true;
}

bool publishMQTT(const char* topic, const char* payload) {
  // Set topic
  char topicCmd[128];
  snprintf(topicCmd, sizeof(topicCmd), "AT+CMQTTTOPIC=0,%d", strlen(topic));
  SerialAT.println(topicCmd);
  delay(500);
  SerialAT.write(topic);
  delay(500);

  // Read response
  String resp = "";
  unsigned long start = millis();
  while (millis() - start < 3000) {
    while (SerialAT.available()) resp += (char)SerialAT.read();
    if (resp.indexOf("OK") != -1) break;
  }

  // Set payload
  char payloadCmd[128];
  snprintf(payloadCmd, sizeof(payloadCmd), "AT+CMQTTPAYLOAD=0,%d", strlen(payload));
  SerialAT.println(payloadCmd);
  delay(500);
  SerialAT.write(payload);
  delay(500);

  resp = "";
  start = millis();
  while (millis() - start < 3000) {
    while (SerialAT.available()) resp += (char)SerialAT.read();
    if (resp.indexOf("OK") != -1) break;
  }

  // Publish (QoS 0, timeout 60s)
  if (!sendATCommand("AT+CMQTTPUB=0,0,60", "+CMQTTPUB: 0,0", 10000)) {
    Serial.println("[Publish] ERROR: Publish failed.");
    return false;
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(3000);

  Serial.println("\n=============================================");
  Serial.println("  ESP32-S3 SIM7670 Native MQTT+SSL Dashboard");
  Serial.println("=============================================");

  // Read an unconnected analog pin to generate a truly random seed
  randomSeed(analogRead(0)); 

  // Initial random stagger (0 to 3000ms) so devices scatter immediately on boot
  currentJitter = random(0, 3000); 

  powerOn();

  if (!connectNetwork()) {
    Serial.println("[Setup] Network failed. Halting.");
    while (1) delay(1000);
  }

  if (!connectMQTT()) {
    Serial.println("[Setup] MQTT failed. Halting.");
    while (1) delay(1000);
  }

  Serial.println("[Setup] All systems ready. Entering loop...\n");
}

void loop() {
  // Drain any async modem output
  while (SerialAT.available()) {
    Serial.write(SerialAT.read());
  }

  unsigned long currentTime = millis();

  // Fire only when base interval + random jitter has elapsed
  if (currentTime - lastPublishTime >= (BASE_INTERVAL + currentJitter)) {
    // 1. Read and Calculate Battery Voltages
    float battery1Voltage = (analogRead(BATTERY_PIN) / 4095.0) * 3.3 * 5.0;
    float battery2Voltage = (analogRead(VOLTAGE_SENSOR_2_PIN) / 4095.0) * 3.3 * 5.0;

    // 2. Read AC Power Statuses
    String ac1Status = (analogRead(HW122_1_VOUT_PIN) > 2000) ? "ON" : "OFF";
    String ac2Status = (analogRead(HW122_2_VOUT_PIN) > 2000) ? "ON" : "OFF";

    // 3. Create JSON Payload with all parameters
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"battery_1_voltage\":%.2f,\"battery_2_voltage\":%.2f,\"ac_1_status\":\"%s\",\"ac_2_status\":\"%s\"}",
             battery1Voltage, battery2Voltage, ac1Status.c_str(), ac2Status.c_str());

    Serial.print("[Publish] Sending: ");
    Serial.print(payload);

    if (publishMQTT(mqtt_topic, payload)) {
      Serial.println(" -> OK");
    } else {
      Serial.println(" -> FAILED");
    }

    lastPublishTime = currentTime;

    // Generate a new offset between -500ms and +500ms for the next cycle
    currentJitter = random(-500, 500);
  }
}
