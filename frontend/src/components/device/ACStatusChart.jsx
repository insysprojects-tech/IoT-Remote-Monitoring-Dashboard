import ReactECharts from 'echarts-for-react';
import { useTheme } from '../../hooks/useTheme';

export const ACStatusChart = ({ data = [] }) => {
  const times = data.map(d => new Date(d.time).toLocaleString());
  
  // Map ON to 1, OFF to 0 (supports ac_1_status/ac_2_status and main_mcb_status/fsds_mcb_status)
  const ac1 = data.map(d => (d.ac_1_status ?? d.main_mcb_status) === 'ON' ? 1 : 0);
  const ac2 = data.map(d => (d.ac_2_status ?? d.fsds_mcb_status) === 'ON' ? 1 : 0);

  const { isDark } = useTheme();
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
      formatter: (params) => {
        let res = params[0].axisValue + '<br/>';
        params.forEach(p => {
          res += `${p.seriesName}: ${p.value === 1 ? 'ON' : 'OFF'}<br/>`;
        });
        return res;
      }
    },
    legend: {
      data: ['Main MCB', 'FSDS MCB'],
      textStyle: { color: textColor },
      top: 0
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: { color: textColor },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1.2,
      splitNumber: 1,
      axisLabel: {
        formatter: (value) => (value === 1 ? 'ON' : value === 0 ? 'OFF' : ''),
        color: textColor
      },
      splitLine: { lineStyle: { color: gridColor } }
    },
    series: [
      {
        name: 'Main MCB',
        type: 'line',
        step: 'end',
        data: ac1,
        itemStyle: { color: '#f39c12' },
        lineStyle: { width: 2 }
      },
      {
        name: 'FSDS MCB',
        type: 'line',
        step: 'end',
        data: ac2,
        itemStyle: { color: '#9b59b6' },
        lineStyle: { width: 2 }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />;
};
