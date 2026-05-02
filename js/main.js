const API_URL = 'http://localhost:8000/api';

function handleDragOver(e) { 
    e.preventDefault(); 
    document.getElementById('upload-zone').classList.add('drag-over'); 
}

function handleDragLeave(e) { 
    document.getElementById('upload-zone').classList.remove('drag-over'); 
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
}

function handleFile(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
}

async function uploadFile(file) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }
        
        const result = await response.json();
        updateDashboard(result);
    } catch (err) {
        alert('Error analyzing file: ' + err.message + '\n\nMake sure the backend is running with: uvicorn backend.server:app --reload');
        document.getElementById('status-dot').className = 'dot error';
        document.getElementById('status-text').textContent = 'ERROR';
    } finally {
        overlay.style.display = 'none';
    }
}

function updateDashboard(response) {
    const { metadata, data, analysis } = response;
    
    document.getElementById('upload-zone').style.display = 'none';
    const dash = document.getElementById('dashboard');
    dash.style.display = 'block';

    // Header info
    document.getElementById('file-name-display').textContent = '⊡ ' + metadata.filename;
    document.getElementById('meta-airfoil').textContent = metadata.airfoil_name !== 'Unknown' ? metadata.airfoil_name : 'Airfoil';
    
    if (metadata.reynolds_num) {
        document.getElementById('meta-re').textContent = `Re = ${(metadata.reynolds_num / 1e6).toFixed(3)}e6`;
        document.getElementById('meta-re').style.display = 'inline-block';
    } else {
        document.getElementById('meta-re').style.display = 'none';
    }
    
    if (metadata.mach_num) {
        document.getElementById('meta-mach').textContent = `M = ${metadata.mach_num.toFixed(3)}`;
        document.getElementById('meta-mach').style.display = 'inline-block';
    } else {
        document.getElementById('meta-mach').style.display = 'none';
    }

    document.getElementById('status-dot').className = 'dot live';
    document.getElementById('status-text').textContent = `POLAR ACTIVE — ${data.length} pts`;

    // KPI Cards
    const kpis = [
        { label:'C_L,max', value: analysis.CL_max.toFixed(3), sub:`α_stall ≈ ${analysis.alpha_stall.toFixed(1)}°`, color:'var(--accent2)', key:'--kpi-color' },
        { label:'α_stall (Onset)', value: analysis.alpha_stall.toFixed(1)+'°', sub:'Flow separation onset', color:'var(--red)' },
        { label:'C_D,min', value: analysis.CD_min.toFixed(5), sub:`@ α = ${analysis.alpha_CD_min.toFixed(1)}°`, color:'var(--accent)' },
        { label:'(L/D)_max', value: analysis.LD_max.toFixed(1), sub:`@ α = ${analysis.alpha_LD_max.toFixed(1)}°`, color:'var(--accent5)' },
        { label:'α₀L', value: analysis.alpha_zero_lift !== null ? analysis.alpha_zero_lift.toFixed(2)+'°' : 'N/A', sub:'Zero-Lift Angle', color:'var(--accent4)' },
        { label:'C_Lα', value: analysis.CL_alpha !== null ? analysis.CL_alpha.toFixed(3) : 'N/A', sub:'[/rad] Linear slope', color:'var(--accent3)' },
    ];
    
    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = '';
    kpis.forEach(k => {
        grid.innerHTML += `<div class="kpi-card" style="--kpi-color:${k.color}">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-sub">${k.sub}</div>
        </div>`;
    });

    // Regime bar
    document.getElementById('regime-bar').style.display = 'block';
    document.getElementById('reg-label-start').textContent = data[0].alpha.toFixed(1)+'°';
    document.getElementById('reg-label-stall').textContent = 'Stall Onset ≈ '+analysis.alpha_stall.toFixed(1)+'°';
    document.getElementById('reg-label-end').textContent = data[data.length-1].alpha.toFixed(1)+'°';

    // Badges
    document.getElementById('badge-clmax').textContent = 'C_L,max = '+analysis.CL_max.toFixed(3);
    document.getElementById('badge-cdmin').textContent = 'C_D,min = '+analysis.CD_min.toFixed(5);
    document.getElementById('badge-ldmax').textContent = '(L/D)_max = '+analysis.LD_max.toFixed(1);

    // Charts
    window.renderDashboardCharts(data, analysis);

    // Data Table
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    data.forEach((d, i) => {
        const ld = (d.CL/d.CD).toFixed(2);
        const isStall = i === analysis.stall_idx;
        const isLD  = d.alpha === analysis.alpha_LD_max;
        
        let tag = '';
        if(isStall) tag = '<span class="tag tag-red">STALL ONSET</span>';
        else if(isLD) tag = '<span class="tag tag-green">OPT. EFFICIENCY</span>';
        
        tbody.innerHTML += `<tr class="${isStall?'stall-row':isLD?'highlight':''}">
            <td>${d.alpha.toFixed(2)}°${tag}</td>
            <td>${d.CL.toFixed(4)}</td>
            <td>${d.CD.toFixed(5)}</td>
            <td>${d.Cm !== null ? d.Cm.toFixed(4) : '—'}</td>
            <td>${ld}</td>
        </tr>`;
    });

    // Parameters Table
    const kppBody = document.getElementById('kpp-body');
    kppBody.innerHTML = '';
    const kpps = [
        ['C_L,max (Max Lift)', analysis.CL_max.toFixed(4), analysis.alpha_stall.toFixed(2)+'°', 'tag-red'],
        ['C_D,min (Min Drag)', analysis.CD_min.toFixed(5), analysis.alpha_CD_min.toFixed(2)+'°', 'tag-blue'],
        ['(L/D)_max (Efficiency)', analysis.LD_max.toFixed(2), analysis.alpha_LD_max.toFixed(2)+'°', 'tag-green'],
        ['α₀L (Zero-lift α)', analysis.alpha_zero_lift !== null ? analysis.alpha_zero_lift.toFixed(3)+'°' : 'N/A', '—', ''],
        ['C_Lα (Lift curve slope)', analysis.CL_alpha !== null ? analysis.CL_alpha.toFixed(4)+' /rad' : 'N/A', 'Linear region', ''],
    ];
    
    if (analysis.CD0 !== null) {
        kpps.push(['C_D0 (Parasite Drag)', analysis.CD0.toFixed(5), '—', '']);
    }
    
    if (analysis.Cm_zero_lift !== null) {
        kpps.push(['C_m0 (Zero-lift Cm)', analysis.Cm_zero_lift.toFixed(4), '—', '']);
    }
    
    if (analysis.Cm_alpha !== null) {
        kpps.push(['C_mα (Stability slope)', analysis.Cm_alpha.toFixed(4)+' /rad', 'Linear region', '']);
    }

    kpps.forEach(([param, val, at, tagClass]) => {
        kppBody.innerHTML += `<tr>
            <td>${param}</td>
            <td style="color:var(--accent)">${val}</td>
            <td>${at}${tagClass ? '<span class="tag '+tagClass+'">key</span>' : ''}</td>
        </tr>`;
    });
}
