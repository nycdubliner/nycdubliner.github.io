document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const vramPreset = document.getElementById('vram-preset');
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
        const capacityVRAM = parseFloat(vramPreset.value);
        const params = parseFloat(paramsSlider.value);
        const quantBits = parseFloat(quantSlider.value);
        const context = parseInt(contextSlider.value);
        const isMoE = moeToggle.checked;
        const totalExperts = parseInt(expertsSlider.value);
        const activeExperts = parseInt(activeExpertsSlider.value);

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
        let sysramUsed = 0;

        if (totalRequiredGB > capacityVRAM) {
            vramUsed = capacityVRAM;
            sysramUsed = totalRequiredGB - capacityVRAM;
        }

        const vramPercent = (vramUsed / capacityVRAM) * 100;
        vramFill.style.width = `${Math.min(vramPercent, 100)}%`;
        vramText.textContent = `${vramUsed.toFixed(1)} GB (${Math.round(vramPercent)}%)`;

        if (sysramUsed > 0) {
            sysramSpillLabel.textContent = `${sysramUsed.toFixed(1)} GB spilled`;
            const sysramCapacity = 64; // arbitrary max scale for visual
            const sysPercent = (sysramUsed / sysramCapacity) * 100;
            sysramFill.style.width = `${Math.min(sysPercent, 100)}%`;
            sysramText.textContent = `${sysramUsed.toFixed(1)} GB in System RAM`;
        } else {
            sysramSpillLabel.textContent = `0 GB needed`;
            sysramFill.style.width = `0%`;
            sysramText.textContent = `No spillage`;
        }

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

        // Insights
        if (sysramUsed === 0) {
            insightBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            insightBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            insightBox.style.color = '#10b981';
            insightBox.innerHTML = `<strong>Perfect Fit!</strong> The entire model (${totalRequiredGB.toFixed(1)}GB) and KV cache fit entirely in your ${capacityVRAM}GB VRAM. Maximum inference speed.`;
        } else if (activeRequiredGB <= capacityVRAM) {
            insightBox.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            insightBox.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            insightBox.style.color = '#f59e0b';
            insightBox.innerHTML = `<strong>Partial Offload.</strong> Your active compute footprint (${activeRequiredGB.toFixed(1)}GB) fits in VRAM, but the rest of the model spills ${sysramUsed.toFixed(1)}GB into System RAM. Expect slower generation due to PCIe bus transfers during expert fetching.`;
        } else {
            insightBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            insightBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            insightBox.style.color = '#ef4444';
            insightBox.innerHTML = `<strong>Heavy Spillage.</strong> Even the active compute parameters exceed your VRAM. You will experience massive slowdowns (1-2 tokens/sec) as the GPU constantly swaps active layers with System RAM.`;
        }
    }

    const inputs = [
        vramPreset, paramsSlider, quantSlider, contextSlider,
        expertsSlider, activeExpertsSlider
    ];

    inputs.forEach(input => {
        input.addEventListener('input', updateVisualizer);
    });

    moeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            moeControls.classList.remove('hidden');
        } else {
            moeControls.classList.add('hidden');
        }
        updateVisualizer();
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
