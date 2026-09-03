/*
 * ============================================================================
 * IoT Remote Monitoring Dashboard — ESP32 WiFi Firmware
 * ============================================================================
 * 
 * Hardware: ESP32 / ESP32-S3 Dev Module
 * Transport: WiFi (WPA2) + MQTT over TLS/SSL (Port 8883)
 * Broker: EMQX Cloud (j18eff7a.ala.asia-southeast1.emqxsl.com)
 * Dynamic Topic: test/devices/{MAC_ADDRESS}/power
 * 
 * Target Network:
 *   - SSID:     "Goog"
 *   - Password: "iiitchaipiyo"
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// ============================================================================
// CONFIGURATION: WiFi & Cloud MQTT
// ============================================================================

// --- WiFi Credentials ---
const char* ssid     = "Goog";
const char* password = "iiitchaipiyo";

// --- EMQX Cloud MQTT Settings ---
const char* mqtt_server   = "j18eff7a.ala.asia-southeast1.emqxsl.com";
const int   mqtt_port     = 8883;       // TLS/SSL Secure Port
const char* mqtt_username = "test1";
const char* mqtt_password = "test1";

// --- Device MAC & Topic Configuration ---
// Leave empty ("") to automatically derive identity from the hardware WiFi MAC
// Or specify a custom MAC string if you want to test against a registered device
const char* CUSTOM_MAC_OVERRIDE = ""; 

char macAddress[20]   = "";
char mqtt_topic[128]  = "";
char mqtt_client_id[64] = "";

// ============================================================================
// SENSOR CONFIGURATION & PINS
// ============================================================================

// --- ADC Sensor Pins ---
const int BATTERY_PIN            = 7;  // Battery 1 Voltage Divider ADC
const int VOLTAGE_SENSOR_2_PIN   = 6;  // Battery 2 Voltage Divider ADC
const int HW122_1_VOUT_PIN       = 5;  // AC Line 1 HW-122 Module ADC
const int HW122_2_VOUT_PIN       = 8;  // AC Line 2 HW-122 Module ADC

// Set to true if testing without physical sensor hardware connected
// This will generate realistic live demo telemetry (11.5V - 13.5V & AC ON/OFF)
#define SIMULATE_SENSORS false

// Voltage divider calibration constants
const float ADC_REF_VOLTAGE    = 3.3;
const float ADC_RESOLUTION     = 4095.0;
const float VOLTAGE_DIVIDER_RATIO = 5.0; // Ratio for standard 25V voltage sensors

// ============================================================================
// TIMING & PUBLISH INTERVALS
// ============================================================================

const unsigned long BASE_INTERVAL = 3000;  // 3 seconds base interval
unsigned long lastPublishTime = 0;
long currentJitter = 0;
unsigned long lastReconnectAttempt = 0;

// ============================================================================
// CLIENTS & HANDLERS
// ============================================================================

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

void setupIdentity() {
  if (strlen(CUSTOM_MAC_OVERRIDE) > 0) {
    strncpy(macAddress, CUSTOM_MAC_OVERRIDE, sizeof(macAddress) - 1);
  } else {
    String mac = WiFi.macAddress();
    strncpy(macAddress, mac.c_str(), sizeof(macAddress) - 1);
  }

  // Construct Dynamic Topic: test/devices/{MAC}/power
  snprintf(mqtt_topic, sizeof(mqtt_topic), "test/devices/%s/power", macAddress);
  
  // Construct Unique Client ID: ESP32-WiFi-{MAC}
  snprintf(mqtt_client_id, sizeof(mqtt_client_id), "ESP32-WiFi-%s", macAddress);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n[WiFi] Connecting to network: " + String(ssid));
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n[WiFi] Connection timed out. Will retry in main loop.");
  }
}

bool connectMQTT() {
  if (client.connected()) return true;

  Serial.println("\n[MQTT] Connecting to EMQX Broker: " + String(mqtt_server) + ":" + String(mqtt_port));
  Serial.println("[MQTT] Client ID: " + String(mqtt_client_id));
  Serial.println("[MQTT] Publishing Topic: " + String(mqtt_topic));

  if (client.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
    Serial.println("[MQTT] Connected to EMQX Cloud successfully (TLS/SSL)! 🚀");
    return true;
  } else {
    Serial.print("[MQTT] Connection failed, rc=");
    Serial.print(client.state());
    Serial.println(" (Will retry in 5s)");
    return false;
  }
}

// ============================================================================
// ARDUINO SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=================================================");
  Serial.println("  ESP32 WiFi Remote Monitoring Dashboard Client");
  Serial.println("=================================================");

  // Seed random generator with floating analog pin noise
  randomSeed(analogRead(0));
  currentJitter = random(0, 2000);

  // Initialize WiFi & Device Identity
  WiFi.mode(WIFI_STA);
  setupIdentity();

  Serial.print("[Device] MAC Address  : "); Serial.println(macAddress);
  Serial.print("[Device] Target Topic : "); Serial.println(mqtt_topic);

  // Connect to WiFi
  connectWiFi();

  // Configure Secure TLS Client
  // setInsecure() allows TLS connection without local CA certificate bundle (standard for EMQX Cloud tests)
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(512); // Ensure buffer fits JSON payload + topic

  // Initial MQTT connect
  if (WiFi.status() == WL_CONNECTED) {
    connectMQTT();
  }

  Serial.println("[Setup] All systems initialized. Starting telemetry loop...\n");
}

// ============================================================================
// ARDUINO MAIN LOOP
// ============================================================================

void loop() {
  unsigned long now = millis();

  // 1. Maintain WiFi Connection
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      connectWiFi();
    }
    return;
  }

  // 2. Maintain MQTT Connection
  if (!client.connected()) {
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      connectMQTT();
    }
  } else {
    client.loop();
  }

  // 3. Telemetry Publishing Cycle
  if (now - lastPublishTime >= (BASE_INTERVAL + currentJitter)) {
    float battery1Voltage = 0.0;
    float battery2Voltage = 0.0;
    String ac1Status = "OFF";
    String ac2Status = "OFF";

#if SIMULATE_SENSORS
    // Simulation Mode for Bench Testing
    battery1Voltage = 12.20 + ((float)random(0, 120) / 100.0); // 12.20V - 13.40V
    battery2Voltage = 11.90 + ((float)random(0, 90) / 100.0);  // 11.90V - 12.80V
    ac1Status = (random(0, 10) > 1) ? "ON" : "OFF";            // 90% ON
    ac2Status = (random(0, 10) > 3) ? "ON" : "OFF";            // 70% ON
#else
    // Actual Hardware ADC Pin Readings
    battery1Voltage = (analogRead(BATTERY_PIN) / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO;
    battery2Voltage = (analogRead(VOLTAGE_SENSOR_2_PIN) / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO;

    ac1Status = (analogRead(HW122_1_VOUT_PIN) > 2000) ? "ON" : "OFF";
    ac2Status = (analogRead(HW122_2_VOUT_PIN) > 2000) ? "ON" : "OFF";
#endif

    // 4. Construct JSON Payload
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"battery_1_voltage\":%.2f,\"battery_2_voltage\":%.2f,\"ac_1_status\":\"%s\",\"ac_2_status\":\"%s\"}",
             battery1Voltage, battery2Voltage, ac1Status.c_str(), ac2Status.c_str());

    // 5. Transmit Payload via MQTT
    Serial.print("[Publish] Topic: ");
    Serial.print(mqtt_topic);
    Serial.print(" | Payload: ");
    Serial.print(payload);

    if (client.connected()) {
      bool success = client.publish(mqtt_topic, payload);
      if (success) {
        Serial.println(" -> ✅ SUCCESS");
      } else {
        Serial.println(" -> ❌ FAILED (Publish Error)");
      }
    } else {
      Serial.println(" -> ⚠️ SKIPPED (MQTT Offline)");
    }

    lastPublishTime = now;

    // Introduce randomized jitter (-500ms to +500ms) to prevent burst synchronization
    currentJitter = random(-500, 500);
  }
}
