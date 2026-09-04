import ReactECharts from 'echarts-for-react';

export const VoltageChart = ({ data = [] }) => {
  // Format data for ECharts
  const times = data.map(d => new Date(d.time).toLocaleString());
  const v1 = data.map(d => d.battery_1_voltage);
  const v2 = data.map(d => d.battery_2_voltage);

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDarkMode ? '#b2bec3' : '#6b7c8a';
  const gridColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
      textStyle: { color: isDarkMode ? '#fff' : '#000' },
      valueFormatter: (value) => (value !== null && value !== undefined ? `${Number(value).toFixed(2)} V` : '--')
    },
    legend: {
      data: ['Battery 1', 'Battery 2'],
      textStyle: { color: textColor },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'value',
      min: (value) => {
        if (!Number.isFinite(value.min) || value.min <= 0) return 0;
        return Math.max(0, Math.min(9, Math.floor(value.min)));
      },
      max: (value) => {
        if (!Number.isFinite(value.max) || value.max <= 0) return 15;
        return Math.max(15, Math.ceil(value.max));
      },
      axisLabel: { formatter: '{value} V', color: textColor },
      splitLine: { lineStyle: { color: gridColor } }
    },
    series: [
      {
        name: 'Battery 1',
        type: 'line',
        data: v1,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#27ae60' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(39, 174, 96, 0.3)' }, { offset: 1, color: 'rgba(39, 174, 96, 0)' }]
          }
        }
      },
      {
        name: 'Battery 2',
        type: 'line',
        data: v2,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#3498db' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(52, 152, 219, 0.3)' }, { offset: 1, color: 'rgba(52, 152, 219, 0)' }]
          }
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};
