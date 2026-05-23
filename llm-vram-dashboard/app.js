document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const vramSlider = document.getElementById('vram-slider');
    const vramPreset = document.getElementById('vram-preset');
    const vramVal = document.getElementById('vram-val');
    
    const bwSlider = document.getElementById('bw-slider');
    const bwVal = document.getElementById('bw-val');
    const hwPresetSelect = document.getElementById('hw-preset');

    const paramsSlider = document.getElementById('params-slider');
    const paramsValue = document.getElementById('params-value');
    const quantSlider = document.getElementById('quant-slider');
    const quantValue = document.getElementById('quant-value');
    const contextSlider = document.getElementById('context-slider');
    const contextValue = document.getElementById('context-value');
    
    const moeToggle = document.getElementById('moe-toggle');
    const moeControls = document.getElementById('moe-controls');
    const expertsSlider = document.getElementById('experts-slider');
    const expertsValue = document.getElementById('experts-value');
    const activeExpertsSlider = document.getElementById('active-experts-slider');
    const activeExpertsValue = document.getElementById('active-experts-value');

    const totalSizeMetric = document.getElementById('total-size-metric');
    const activeSizeMetric = document.getElementById('active-size-metric');

    const vramCapacityLabel = document.getElementById('vram-capacity-label');
    const vramFill = document.getElementById('vram-fill');
    const vramText = document.getElementById('vram-text');

    const sysramSpillLabel = document.getElementById('sysram-spill-label');
    const sysramFill = document.getElementById('sysram-fill');
    const sysramText = document.getElementById('sysram-text');
    const sysramBox = document.getElementById('sysram-box');
    const insightBox = document.getElementById('insight-box');

    const GB_DIVISOR = 8; // bits to Bytes

    function getQuantName(bits) {
        if (bits == 16) return "16 bits (FP16/BF16)";
        if (bits == 8) return "8 bits (Q8_0)";
        if (bits == 6) return "6 bits (Q6_K)";
        if (bits == 5) return "5 bits (Q5_K_M)";
        if (bits == 4.5) return "4.5 bits (Q4_K_M)";
        if (bits == 4) return "4 bits (Q4_0)";
        if (bits == 3) return "3 bits (IQ3_M)";
        if (bits == 2) return "2 bits (IQ2_XXS)";
        return `${bits} bits`;
    }

    function updateVisualizer() {
        const params = parseFloat(paramsSlider.value);
        const quantBits = parseFloat(quantSlider.value);
        const context = parseInt(contextSlider.value);
        const isMoE = moeToggle.checked;
        const totalExperts = parseInt(expertsSlider.value);
        const activeExperts = parseInt(activeExpertsSlider.value);
        
        const capacityVRAM = parseFloat(vramSlider.value);
        const memBw = parseFloat(bwSlider.value);

        // UI Updates
        paramsValue.textContent = `${params}B`;
        quantValue.textContent = getQuantName(quantBits);
        contextValue.textContent = `${context}`;
        expertsValue.textContent = totalExperts;
        activeExpertsValue.textContent = activeExperts;
        vramCapacityLabel.textContent = `${capacityVRAM} GB`;

        // Validation for MoE
        if (activeExperts > totalExperts) {
            activeExpertsSlider.value = totalExperts;
        }

        // Context Memory roughly ~1GB per 8k tokens for 70B
        const contextOverheadGB = (context / 8192) * (params / 35); 

        let totalParams = params;
        let activeParams = params;

        if (isMoE) {
            // Assume 1/3 shared, 2/3 experts
            const sharedParams = params * 0.33;
            const expertParams = params * 0.67;
            totalParams = sharedParams + (expertParams * totalExperts);
            activeParams = sharedParams + (expertParams * activeExperts);
        }

        const totalModelGB = (totalParams * quantBits) / GB_DIVISOR;
        const activeModelGB = (activeParams * quantBits) / GB_DIVISOR;
        
        const totalRequiredGB = totalModelGB + contextOverheadGB;
        const activeRequiredGB = activeModelGB + contextOverheadGB;

        totalSizeMetric.textContent = `${totalRequiredGB.toFixed(1)} GB`;
        activeSizeMetric.textContent = `${activeRequiredGB.toFixed(1)} GB`;

        let vramUsed = totalRequiredGB;
        let spillSize = 0;

        if (totalRequiredGB > capacityVRAM) {
            vramUsed = capacityVRAM;
            spillSize = totalRequiredGB - capacityVRAM;
        }

        const vramPercent = (vramUsed / capacityVRAM) * 100;
        vramFill.style.width = `${Math.min(vramPercent, 100)}%`;
        vramText.textContent = `${vramUsed.toFixed(1)} GB (${Math.round(vramPercent)}%)`;

        // Colors
        if (vramPercent >= 100 && activeRequiredGB > capacityVRAM) {
            vramFill.style.backgroundColor = 'var(--vram-danger)';
            vramFill.style.boxShadow = '0 0 15px var(--vram-danger)';
        } else if (vramPercent >= 100) {
            vramFill.style.backgroundColor = 'var(--vram-warn)';
            vramFill.style.boxShadow = '0 0 15px var(--vram-warn)';
        } else {
            vramFill.style.backgroundColor = 'var(--vram-safe)';
            vramFill.style.boxShadow = '0 0 15px var(--vram-safe)';
        }

        // Insights / Spillage Logic
        let sysSpillFill = 0;
        let tpsStr = '';

        if (spillSize > 0) {
            sysSpillFill = Math.min(100, (spillSize / 64) * 100); 
            sysramFill.style.width = sysSpillFill + '%';
            sysramText.textContent = `${spillSize.toFixed(1)} GB Spilled`;
            sysramSpillLabel.textContent = `${spillSize.toFixed(1)} GB needed`;
            sysramBox.style.borderColor = 'var(--vram-danger)';
            
            const effectiveBw = Math.min(memBw, 100); 
            const tps = effectiveBw / activeRequiredGB;
            tpsStr = `<br><span style="color:var(--vram-danger); margin-top: 0.5rem; display: block;">⚠️ High spillage penalty! Theoretical Max: <b>~${tps.toFixed(1)} t/s</b></span>`;
            
            insightBox.innerHTML = `Model requires <b>${spillSize.toFixed(1)} GB</b> of System RAM offloading. Performance will be severely degraded due to PCIe/System RAM bottlenecks.${tpsStr}`;
            insightBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            insightBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            insightBox.style.color = '#ef4444';
        } else {
            sysramFill.style.width = '0%';
            sysramText.textContent = 'No spillage';
            sysramSpillLabel.textContent = '0 GB needed';
            sysramBox.style.borderColor = 'var(--panel-border)';
            
            const tps = memBw / activeRequiredGB;
            tpsStr = `<br><span style="margin-top: 0.5rem; display: block;">Theoretical Max Speed: <b>~${tps.toFixed(1)} tokens/second</b></span>`;

            insightBox.innerHTML = `Fits completely in VRAM! Maximize layer offloading for fastest inference.${tpsStr}`;
            insightBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            insightBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            insightBox.style.color = '#10b981';
        }
    }

    // Sliders
    vramSlider.addEventListener('input', (e) => {
        vramVal.textContent = e.target.value + ' GB';
        vramPreset.value = 'custom';
        updateVisualizer();
    });

    bwSlider.addEventListener('input', (e) => {
        bwVal.textContent = e.target.value + ' GB/s';
        hwPresetSelect.value = 'custom';
        updateVisualizer();
    });

    paramsSlider.addEventListener('input', updateVisualizer);
    quantSlider.addEventListener('input', updateVisualizer);
    contextSlider.addEventListener('input', updateVisualizer);
    expertsSlider.addEventListener('input', updateVisualizer);
    activeExpertsSlider.addEventListener('input', updateVisualizer);

    moeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            moeControls.classList.remove('hidden');
        } else {
            moeControls.classList.add('hidden');
        }
        updateVisualizer();
    });

    // Hardware Presets Data
    const hardwarePresets = [
        {
            group: "Nvidia 50-Series",
            options: [
                { name: "1x RTX 5090", bw: 1792 },
                { name: "2x RTX 5090", bw: 3584 },
                { name: "1x RTX 5080", bw: 960 },
                { name: "2x RTX 5080", bw: 1920 }
            ]
        },
        {
            group: "Nvidia 40-Series",
            options: [
                { name: "1x RTX 4090", bw: 1008 },
                { name: "2x RTX 4090", bw: 2016 },
                { name: "1x RTX 4080", bw: 717 },
                { name: "2x RTX 4080", bw: 1434 },
                { name: "1x RTX 4070 Ti", bw: 504 },
                { name: "2x RTX 4070 Ti", bw: 1008 },
                { name: "1x RTX 4060 Ti", bw: 288 },
                { name: "2x RTX 4060 Ti", bw: 576 }
            ]
        },
        {
            group: "Nvidia 30-Series",
            options: [
                { name: "1x RTX 3090", bw: 936 },
                { name: "2x RTX 3090", bw: 1872 },
                { name: "1x RTX 3080", bw: 760 },
                { name: "2x RTX 3080", bw: 1520 },
                { name: "1x RTX 3070", bw: 448 },
                { name: "2x RTX 3070", bw: 896 },
                { name: "1x RTX 3060", bw: 360 },
                { name: "2x RTX 3060", bw: 720 }
            ]
        },
        {
            group: "AMD RX 7000-Series",
            options: [
                { name: "1x RX 7900 XTX", bw: 960 },
                { name: "2x RX 7900 XTX", bw: 1920 },
                { name: "1x RX 7900 XT", bw: 800 },
                { name: "2x RX 7900 XT", bw: 1600 },
                { name: "1x RX 7800 XT", bw: 624 },
                { name: "2x RX 7800 XT", bw: 1248 },
                { name: "1x RX 7600", bw: 288 },
                { name: "2x RX 7600", bw: 576 }
            ]
        },
        {
            group: "Intel Arc",
            options: [
                { name: "1x A770", bw: 512 },
                { name: "2x A770", bw: 1024 }
            ]
        },
        {
            group: "Mac Silicon (Unified)",
            options: [
                { name: "M2/M3 Ultra", bw: 800 },
                { name: "M2/M3 Max", bw: 400 },
                { name: "M2/M3 Pro", bw: 200 }
            ]
        },
        {
            group: "System RAM",
            options: [
                { name: "DDR5-6000 (Dual Channel)", bw: 96 },
                { name: "DDR4-3200 (Dual Channel)", bw: 51 }
            ]
        }
    ];

    hardwarePresets.forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.group;
        group.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.bw;
            option.textContent = `${opt.name} (~${opt.bw} GB/s)`;
            optgroup.appendChild(option);
        });
        hwPresetSelect.appendChild(optgroup);
    });

    const initialBw = hwPresetSelect.querySelector('option[value="1008"]');
    if (initialBw) {
        initialBw.selected = true;
    }

    hwPresetSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'custom') {
            bwSlider.value = e.target.value;
            bwVal.textContent = e.target.value + ' GB/s';
            updateVisualizer();
        }
    });

    const modelFamilies = [
        {
            family: "Llama 4",
            variants: [
                { name: "8B (Scout)", params: 8, isMoe: false },
                { name: "70B (Maverick)", params: 70, isMoe: false },
                { name: "400B (Commander)", params: 400, isMoe: false }
            ]
        },
        {
            family: "Qwen 3",
            variants: [
                { name: "7B", params: 7, isMoe: false },
                { name: "32B", params: 32, isMoe: false },
                { name: "72B", params: 72, isMoe: false },
                { name: "110B", params: 110, isMoe: false }
            ]
        },
        {
            family: "DeepSeek-V4",
            variants: [
                { name: "R1 (70B)", params: 70, isMoe: false },
                { name: "Pro (236B)", params: 29.5, isMoe: true, tExp: 8, aExp: 2 } 
            ]
        },
        {
            family: "Gemma 3",
            variants: [
                { name: "2B", params: 2, isMoe: false },
                { name: "7B", params: 7, isMoe: false },
                { name: "27B", params: 27, isMoe: false }
            ]
        },
        {
            family: "Gemma 4",
            variants: [
                { name: "2B", params: 2, isMoe: false },
                { name: "9B", params: 9, isMoe: false },
                { name: "26B MoE", params: 3.8, isMoe: true, tExp: 7, aExp: 1 }, 
                { name: "27B", params: 27, isMoe: false }
            ]
        },
        {
            family: "Mixtral",
            variants: [
                { name: "8x7B", params: 7, isMoe: true, tExp: 8, aExp: 2 },
                { name: "8x22B", params: 22, isMoe: true, tExp: 8, aExp: 2 }
            ]
        },
        {
            family: "Phi-4",
            variants: [
                { name: "Mini (4B)", params: 4, isMoe: false },
                { name: "Small (7B)", params: 7, isMoe: false },
                { name: "Medium (14B)", params: 14, isMoe: false }
            ]
        },
        {
            family: "GLM-5.1",
            variants: [
                { name: "9B", params: 9, isMoe: false },
                { name: "130B", params: 130, isMoe: false }
            ]
        }
    ];


    const presetsGrid = document.getElementById('presets-grid');
    presetsGrid.innerHTML = ''; 

    modelFamilies.forEach(group => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `<div class="preset-title">${group.family}</div><div class="variants-container"></div>`;
        
        const container = card.querySelector('.variants-container');
        
        group.variants.forEach(variant => {
            const btn = document.createElement('button');
            btn.className = 'variant-btn';
            btn.textContent = variant.name;
            btn.title = variant.isMoe ? `MoE (${variant.tExp}x${variant.params}B)` : `Dense (${variant.params}B)`;
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                paramsSlider.value = variant.params;
                moeToggle.checked = variant.isMoe;
                
                if (variant.isMoe) {
                    moeControls.classList.remove('hidden');
                    expertsSlider.value = variant.tExp;
                    activeExpertsSlider.value = variant.aExp;
                } else {
                    moeControls.classList.add('hidden');
                }
                
                updateVisualizer();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            
            container.appendChild(btn);
        });
        
        presetsGrid.appendChild(card);
    });

    // Initial render
    updateVisualizer();
});
