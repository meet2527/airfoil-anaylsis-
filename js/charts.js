// Chart.js Configuration & Rendering for Airfoil Analysis
Chart.defaults.color = '#5e7a99';
Chart.defaults.font.family = "'Space Mono', monospace";
Chart.defaults.font.size = 10;

const GRID_COLOR = 'rgba(28,48,80,0.6)';
const TICK_COLOR = '#5e7a99';

let charts = {};

function baseOptions(xLabel, yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { display:false },
      tooltip: {
        backgroundColor: '#0c1420',
        borderColor: '#1c3050',
        borderWidth: 1,
        titleColor: '#00c8ff',
        bodyColor: '#d8e4f0',
        padding: 10
      }
    },
    scales: {
      x: {
        title: { display:true, text:xLabel, color:'#8aa8c8', font:{size:10} },
        grid: { color: GRID_COLOR },
        ticks: { color: TICK_COLOR }
      },
      y: {
        title: { display:true, text:yLabel, color:'#8aa8c8', font:{size:10} },
        grid: { color: GRID_COLOR },
        ticks: { color: TICK_COLOR }
      }
    }
  };
}

function initCharts() {
    // Clear existing charts
    Object.values(charts).forEach(c => {
        if(c) c.destroy();
    });
    charts = {};
}

function renderCLChart(data, stats) {
    const ctx = document.getElementById('chart-cl');
    const alphas = data.map(d => d.alpha);
    const cls = data.map(d => d.CL);
    
    const stallAnnotation = {
        type:'line', xMin:stats.alpha_stall, xMax:stats.alpha_stall,
        borderColor:'rgba(255,71,87,0.5)', borderWidth:1.5, borderDash:[4,3],
        label:{ content:'Stall Onset', display:true, color:'#ff4757', backgroundColor:'transparent', font:{family:'Space Mono',size:9} }
    };

    charts.cl = new Chart(ctx, {
        type:'line',
        data:{
            labels:alphas,
            datasets:[{
                label:'C_L', data:cls,
                borderColor:'#00c8ff', borderWidth:2,
                backgroundColor:'rgba(0,200,255,0.06)',
                fill:true, tension:0.35,
                pointBackgroundColor: alphas.map((a,i) => i === stats.stall_idx ? '#ff4757' : '#00c8ff'),
                pointRadius: alphas.map((a,i) => i === stats.stall_idx ? 6 : 3),
            }]
        },
        options:{
            ...baseOptions('α [deg]','C_L'),
            plugins:{
                ...baseOptions().plugins,
                annotation:{ annotations:{ stallLine: stallAnnotation } },
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    callbacks:{ label: ctx => ` C_L: ${Number(ctx.parsed.y).toFixed(4)}` }
                }
            }
        }
    });
}

function renderCDChart(data, stats) {
    const ctx = document.getElementById('chart-cd');
    const alphas = data.map(d => d.alpha);
    const cds = data.map(d => d.CD);
    
    charts.cd = new Chart(ctx, {
        type:'line',
        data:{
            labels:alphas,
            datasets:[{
                label:'C_D', data:cds,
                borderColor:'#ff6b35', borderWidth:2,
                backgroundColor:'rgba(255,107,53,0.06)',
                fill:true, tension:0.35,
                pointRadius:3, pointBackgroundColor:'#ff6b35'
            }]
        },
        options:{
            ...baseOptions('α [deg]','C_D'),
            plugins:{
                ...baseOptions().plugins,
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    titleColor:'#ff6b35',
                    callbacks:{ label: ctx => ` C_D: ${Number(ctx.parsed.y).toFixed(5)}` }
                }
            }
        }
    });
}

function renderLDChart(data, stats) {
    const ctx = document.getElementById('chart-ld');
    const alphas = data.map(d => d.alpha);
    const lds = data.map(d => d.CL / d.CD);
    
    charts.ld = new Chart(ctx, {
        type:'line',
        data:{
            labels:alphas,
            datasets:[{
                label:'L/D', data:lds,
                borderColor:'#ffd43b', borderWidth:2,
                backgroundColor:'rgba(255,212,59,0.06)',
                fill:true, tension:0.35,
                pointRadius: alphas.map(a => a===stats.alpha_LD_max ? 7 : 3),
                pointBackgroundColor: alphas.map(a => a===stats.alpha_LD_max ? '#ffd43b' : '#b09a25'),
            }]
        },
        options:{
            ...baseOptions('α [deg]','L/D'),
            plugins:{
                ...baseOptions().plugins,
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    titleColor:'#ffd43b',
                    callbacks:{ label: ctx => ` L/D: ${Number(ctx.parsed.y).toFixed(2)}` }
                }
            }
        }
    });
}

function renderPolarChart(data) {
    const ctx = document.getElementById('chart-polar');
    const polarData = data.map(d=>({ x: d.CD, y: d.CL }));
    
    charts.polar = new Chart(ctx, {
        type:'scatter',
        data:{
            datasets:[{
                label:'Polar', data:polarData,
                borderColor:'#00ff9d', backgroundColor:'rgba(0,255,157,0.08)',
                borderWidth:1.5, pointRadius:4, showLine:true, tension:0.3
            }]
        },
        options:{
            ...baseOptions('C_D','C_L'),
            plugins:{
                ...baseOptions().plugins,
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    titleColor:'#00ff9d',
                    callbacks:{
                        title: items => `α = ${data[items[0].dataIndex].alpha}°`,
                        label: ctx => ` C_D: ${ctx.parsed.x.toFixed(5)}  C_L: ${ctx.parsed.y.toFixed(4)}`
                    }
                }
            }
        }
    });
}

function renderCmChart(data) {
    const ctx = document.getElementById('chart-cm');
    const alphas = data.map(d => d.alpha);
    const cms = data.map(d => d.Cm);
    
    const hasCm = cms.every(v => v !== null && v !== undefined);
    
    if (!hasCm) {
        ctx.parentElement.style.opacity='0.35';
        ctx.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:0.8rem;font-family:var(--mono)">No Cm data in file</div>';
        return;
    }

    charts.cm = new Chart(ctx, {
        type:'line',
        data:{
            labels:alphas,
            datasets:[{
                label:'C_m', data:cms,
                borderColor:'#bf5fff', borderWidth:2,
                backgroundColor:'rgba(191,95,255,0.06)',
                fill:true, tension:0.35,
                pointRadius:3, pointBackgroundColor:'#bf5fff'
            }]
        },
        options:{
            ...baseOptions('α [deg]','C_m'),
            plugins:{
                ...baseOptions().plugins,
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    titleColor:'#bf5fff',
                    callbacks:{ label: ctx => ` C_m: ${Number(ctx.parsed.y).toFixed(4)}` }
                },
                annotation:{ annotations:{
                    zeroLine:{
                        type:'line', yMin:0, yMax:0,
                        borderColor:'rgba(255,255,255,0.12)', borderWidth:1, borderDash:[4,4]
                    }
                }}
            }
        }
    });
}

function renderStabilityChart(data) {
    const ctx = document.getElementById('chart-stability');
    if (!ctx) return;
    
    const cms = data.map(d => d.Cm);
    const hasCm = cms.every(v => v !== null && v !== undefined);
    
    if (!hasCm) {
        ctx.parentElement.style.opacity='0.35';
        ctx.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:0.8rem;font-family:var(--mono)">No Cm data in file</div>';
        return;
    }

    const stabilityData = data.map(d=>({ x: d.CL, y: d.Cm }));
    
    charts.stability = new Chart(ctx, {
        type:'scatter',
        data:{
            datasets:[{
                label:'Stability', data:stabilityData,
                borderColor:'#ff4757', backgroundColor:'rgba(255,71,87,0.08)',
                borderWidth:1.5, pointRadius:4, showLine:true, tension:0.3
            }]
        },
        options:{
            ...baseOptions('C_L','C_m'),
            plugins:{
                ...baseOptions().plugins,
                tooltip:{
                    ...baseOptions().plugins.tooltip,
                    titleColor:'#ff4757',
                    callbacks:{
                        title: items => `α = ${data[items[0].dataIndex].alpha}°`,
                        label: ctx => ` C_L: ${ctx.parsed.x.toFixed(4)}  C_m: ${ctx.parsed.y.toFixed(4)}`
                    }
                }
            }
        }
    });
}

window.renderDashboardCharts = function(data, stats) {
    initCharts();
    renderCLChart(data, stats);
    renderCDChart(data, stats);
    renderLDChart(data, stats);
    renderPolarChart(data);
    renderCmChart(data);
    renderStabilityChart(data);
};
