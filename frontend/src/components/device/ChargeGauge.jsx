import ReactECharts from 'echarts-for-react';
import { useTheme } from '../../hooks/useTheme';

export const ChargeGauge = ({ value = 0, label = 'Battery' }) => {
  const { isDark } = useTheme();

  // Status colors matching system tokens
  let statusColor = '#10b981'; // Optimal Green
  if (value <= 0) {
    statusColor = isDark ? '#64748b' : '#94a3b8'; // Muted Gray when 0% / offline
  } else if (value < 20) {
    statusColor = '#f43f5e'; // Critical Red
  } else if (value < 40) {
    statusColor = '#f59e0b'; // Warning Amber
  }

  // Theme-adaptive styling: subtle slate track in light mode, soft dark in dark mode
  const trackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        pointer: { show: false },
        progress: {
          show: value > 0,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            borderWidth: 0,
            color: statusColor
          }
        },
        axisLine: {
          lineStyle: {
            width: 8,
            color: [[1, trackColor]]
          }
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        data: [{
          value: value,
          name: label,
          title: {
            offsetCenter: ['0%', '32%'],
            fontSize: 12,
            fontWeight: 500,
            color: labelColor
          },
          detail: {
            offsetCenter: ['0%', '-8%'],
            valueAnimation: true,
            fontSize: 20,
            fontWeight: 700,
            color: textColor,
            formatter: '{value}%'
          }
        }]
      }
    ]
  };

  return (
    <ReactECharts 
      option={option} 
      style={{ height: '120px', width: '100%' }} 
      notMerge={true} 
      lazyUpdate={true}
    />
  );
};
