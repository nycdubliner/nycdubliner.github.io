# BeeLlama Gemma 4 31B Baseline - Today

Date: 2026-06-12

Machine: `ship`

Hardware:

- 2x AMD Radeon RX 7900 XTX, 24 GB each
- AMD Ryzen 9 5900X
- ROCm 7.2.3
- GPU target: `gfx1100`

Repository:

- `Anbeeld/beellama.cpp`
- Branch: `v0.3.2`
- Build dir on `ship`: `build-rocm`

## Build Notes

The ROCm build initially failed in the rocWMMA Flash Attention path because both packages were present:

```text
librocwmma-dev  7.1.0-0ubuntu1
rocwmma-dev     2.2.0.70203-90~24.04
```

The stale Ubuntu `librocwmma-dev` package owned `/usr/include/rocwmma/rocwmma.hpp` but did not provide matching internal headers, causing:

```text
fatal error: 'internal/accessors.hpp' file not found
```

Resolution: remove the stale `librocwmma-dev` package and use ROCm 7.2.3 rocWMMA headers under `/opt/rocm-7.2.3/include`.

ROCm 7.2.3 is good enough for this baseline. ROCm 7.2.4 may be worth an A/B later, but upgrading before baseline would add noise.

## Models

Target:

```bash
TARGET_HF="unsloth/gemma-4-31b-it-GGUF:UD-Q4_K_XL"
```

Observed cached file:

```text
gemma-4-31B-it-UD-Q4_K_XL.gguf
```

DFlash draft:

```bash
DRAFT_HF="Anbeeld/gemma-4-31B-it-DFlash-GGUF:IQ4_XS"
```

Rationale:

- The local comparison image for `Gemma-4-26B-A4B-it-GGUF` suggests Unsloth Dynamic quants are stronger than ordinary GGUF quants at similar sizes.
- `UD-Q4_K_XL` is the best current one-card target choice that still leaves room for 32k context and DFlash state on a 24 GB 7900 XTX.
- The Anbeeld DFlash card says `IQ4_XS`, `Q4_K_M`, and `Q5_K_M` were close in performance, with `IQ4_XS` using the least VRAM.

## Runtime Defaults

Common settings:

```bash
--host 0.0.0.0
--port 8080
-fa on
--reasoning on
--reasoning-loop-min-tokens 16384
-ngl 999
-fit off
--temp 1.0 --top-p 0.95 --top-k 64
--ctx-size 32768
-np 1
--threads 8
--mmap
--no-mmproj
-ctk q8_0
-ctv q8_0
-b 2048 -ub 512
--metrics
--log-timestamps
```

DFlash settings:

```bash
-hfd "Anbeeld/gemma-4-31B-it-DFlash-GGUF:IQ4_XS"
--spec-type dflash
--no-spec-dm-adaptive
--spec-draft-n-max 16
--spec-draft-p-min 0.0
--spec-draft-ctx-size 1024
--spec-dflash-cross-ctx 1024
--spec-draft-temp auto
-ngld 999
-ctkd q8_0
-ctvd q8_0
```

## Benchmark Prompts

Prose prompt:

```text
Why was A Kind of Blue special.
```

Code prompt:

```text
Write a complete Python 3 module implementing a doubly-linked list with the following methods: append, prepend, insert_at, remove_at, find, reverse, to_list, length, is_empty, iter. Include comprehensive docstrings, type hints, and pytest unit tests for every method. Return only the code, no commentary.
```

## Results

| Config | Prompt | Prompt tok/s | Decode tok/s | Acceptance | Notes |
|---|---|---:|---:|---:|---|
| 1 GPU, no draft, `-np auto` | prose | 101.54 | 29.41 | n/a | server selected 4 slots |
| 1 GPU, no draft, `-np 1` | prose | 114.27 | 29.49 | n/a | clean single-session baseline |
| 1 GPU, DFlash adaptive | prose | 55.51 | 28.35 | 14.3% | DFlash disabled itself |
| 1 GPU, no draft | code | n/a | ~29.4 | n/a | final line not captured, stable around 29.4 |
| 1 GPU, DFlash adaptive | code | 182.23 | 74.78 | 43.51% | strong positive result |
| 1 GPU, DFlash fixed `n_max=16` | code | 181.87 | 78.12 | 42.89% | current speed champion |
| 1 GPU, DFlash fixed `n_max=12` | code | 182.75 | 70.13 | 47.16% | higher acceptance, lower throughput |
| 1 GPU, DFlash fixed `n_max=20` | code | 182.86 | 72.36 | 39.86% | lower acceptance, lower throughput than 16 |
| 1 GPU, DFlash fixed `n_max=16`, `q8_0/q4_0` target KV | code | n/a | tailed to 15.40 | n/a | severe throughput decay as context grew; cancelled |
| 1 GPU, DFlash fixed `n_max=16`, `q5_0/q4_0` target KV | code | n/a | tailed to 18.58 | n/a | same tailoff pattern; cancelled |
| 1 GPU, DFlash fixed `n_max=16`, 64k ctx, `q8_0/q8_0` target KV | code | 182.27 | 71.69 | 39.14% | fits at 23.253/23.984 GiB VRAM |
| 1 GPU, turbo KV smoke | code | n/a | tailed to 21.72 | n/a | turbo cache type works, but is much slower in this quick run |
| 2 GPU, layer, no draft | code | n/a | ~25.65 | n/a | cancelled before final timing |
| 2 GPU, layer, DFlash fixed | code | 167.91 | 62.06 | 37.54% | slower than 1 GPU DFlash, useful capacity baseline |
| 2 GPU, tensor, no draft | code | 251.25 | 35.06 | n/a | best no-draft two-card result |
| 2 GPU, tensor, DFlash fixed | code | n/a | crash | n/a | hidden capture/meta tensor placement issue |
| 1 GPU, MTP `n_max=1` | code | 281.39 | 43.60 | 94.96% | very high acceptance, slower than DFlash |
| 1 GPU, MTP `n_max=2` | code | 280.55 | 36.57 | 90.90% | slower than `n_max=1` |
| 1 GPU, MTP `n_max=3` | code | 281.31 | 42.57 | 90.81% | near `n_max=1`, still slower than DFlash |
| 1 GPU, MTP `n_max=8` | code | 281.80 | 61.17 | 63.57% | similar to `n_max=10` |
| 1 GPU, MTP `n_max=10` | code | 280.75 | 61.86 | 54.79% | best tested MTP so far, still below DFlash |
| 2 GPU, tensor, MTP `n_max=10`, meta fallback, `q8_0/q8_0` | code | 263.13 | 76.12 | 61.99% | competitive with one-card DFlash, but crashed on second request |
| 2 GPU, tensor, MTP `n_max=10`, RCCL verified, `f16/f16` | code | 249.13 | 79.93 | 59.81% | fastest first request, but still crashed on second request |

Current speed champion:

```text
1 GPU, -sm none, UD-Q4_K_XL target, IQ4_XS DFlash, fixed n_max=16, 32k ctx, q8_0 KV
Decode: 78.12 tok/s on code prompt
Speedup over no-draft code prompt: about 2.66x
```

Fastest unstable result:

```text
2 GPU, -sm tensor, MTP n_max=10, 32k ctx, f16/f16 KV, RCCL verified
Decode: 79.93 tok/s on first code prompt
Still crashes on second request
```

## Interpretation

- Single-card fixed DFlash is the best current speed path for code-like completions.
- `--spec-draft-n-max 16` is the best tested DFlash depth so far. `12` had higher acceptance but lower throughput; `20` had lower acceptance and lower throughput.
- Compressed target KV badly tailed off on this workload. It may help capacity, but it is not a speed path with the tested `q8_0/q4_0` or `q5_0/q4_0` settings.
- Turbo cache types are supported by this BeeLlama fork, but the quick smoke run was much slower than `q8_0/q8_0` and should be treated as capacity-only until proven otherwise.
- 64k context fits on one 7900 XTX with `q8_0/q8_0` KV and DFlash, but leaves very little headroom: 23.253 GiB / 23.984 GiB observed in `nvtop`.
- DFlash is prompt-sensitive; it was worse than no draft on short open-ended prose.
- Tensor split helps no-draft single-stream decode compared with one-card no-draft.
- Layer split is slower for this 31B Q4 target, but keep it in the matrix because it matters for larger models and fit/capacity intuition.
- Tensor + DFlash is currently unstable on ROCm/BeeLlama because hidden capture and meta tensor placement interact badly.
- MTP works with this GGUF. On the code prompt, acceptance is extremely high at low draft depths, which may mean the prompt is unusually draft-friendly. Higher MTP depth can still improve throughput despite lower acceptance.
- One-card MTP is slower than the DFlash champion: 61.86 tok/s versus 78.12 tok/s.
- Two-card tensor MTP is competitive with the DFlash champion and can slightly beat it on first-request speed with RCCL verified and `f16/f16` KV: 79.93 tok/s versus 78.12 tok/s. This path is worth keeping because it is likely more relevant for larger models where one-card DFlash is not possible.
- Two-card tensor MTP is not yet stable for repeated requests. A second request crashed in HIP Flash Attention with `No CUDA FA kernel selected: K=q8_0 V=q8_0 D=256` after prompt-cache/SWA full prompt reprocessing.
- Disabling prompt cache did not fix the two-card tensor MTP crash. `-fa off` cannot be used because this fork requires Flash Attention for tensor split. RCCL was verified in `build-rocm-rccl` via `librccl.so.1`, `GGML_CUDA_NCCL:BOOL=ON`, and `GGML_HIP_RCCL:BOOL=ON`, but the repeated-request crash still occurs.
- Forcing MTP draft placement to one GPU with `--spec-draft-device ROCm0` crashes at startup. The draft context creates shared KV tensors in `Meta()` and aborts in scheduler reserve: `pre-allocated tensor (cache_k_l58) in a buffer (Meta()) that cannot run the operation (NONE)`.
- CPU draft offload with `--spec-draft-ngl 0` also crashes in this two-card tensor MTP path.

## Current Commands

Best single-card DFlash:

```bash
HIP_VISIBLE_DEVICES=0 build-rocm/bin/llama-server \
  -hf "$TARGET_HF" \
  -hfd "Anbeeld/gemma-4-31B-it-DFlash-GGUF:IQ4_XS" \
  --spec-type dflash \
  --no-spec-dm-adaptive \
  --spec-draft-n-max 16 \
  --spec-draft-p-min 0.0 \
  --spec-draft-ctx-size 1024 \
  --spec-dflash-cross-ctx 1024 \
  --spec-draft-temp auto \
  --host 0.0.0.0 \
  --port 8080 \
  -fa on \
  --reasoning on \
  --reasoning-loop-min-tokens 16384 \
  -ngl 999 \
  -ngld 999 \
  -fit off \
  --temp 1.0 --top-p 0.95 --top-k 64 \
  --ctx-size 32768 \
  -np 1 \
  --threads 8 \
  --mmap \
  --no-mmproj \
  -sm none \
  -ctk q8_0 \
  -ctv q8_0 \
  -ctkd q8_0 \
  -ctvd q8_0 \
  -b 2048 -ub 512 \
  --metrics \
  --log-timestamps
```

Two-card layer capacity baseline:

```bash
HIP_VISIBLE_DEVICES=0,1 build-rocm/bin/llama-server \
  -hf "$TARGET_HF" \
  --host 0.0.0.0 \
  --port 8080 \
  -fa on \
  --reasoning on \
  --reasoning-loop-min-tokens 16384 \
  -ngl 999 \
  -fit off \
  --temp 1.0 --top-p 0.95 --top-k 64 \
  --ctx-size 32768 \
  -np 1 \
  --threads 8 \
  --mmap \
  --no-mmproj \
  -sm layer \
  -ctk q8_0 \
  -ctv q8_0 \
  -b 2048 -ub 512 \
  --metrics \
  --log-timestamps
```

Two-card tensor no-draft speed baseline:

```bash
HIP_VISIBLE_DEVICES=0,1 build-rocm/bin/llama-server \
  -hf "$TARGET_HF" \
  --host 0.0.0.0 \
  --port 8080 \
  -fa on \
  --reasoning on \
  --reasoning-loop-min-tokens 16384 \
  -ngl 999 \
  -fit off \
  --temp 1.0 --top-p 0.95 --top-k 64 \
  --ctx-size 32768 \
  -np 1 \
  --threads 8 \
  --mmap \
  --no-mmproj \
  -sm tensor \
  -ts 1,1 \
  -ctk q8_0 \
  -ctv q8_0 \
  -b 2048 -ub 512 \
  --metrics \
  --log-timestamps
```

## Today Todo

Before moving to MTP:

- [x] One-card fixed DFlash, `--spec-draft-n-max 12`
- [x] One-card fixed DFlash, `--spec-draft-n-max 20` if accepted by the binary
- [x] One-card fixed DFlash with compressed target KV to see whether context can grow without hurting speed too much
- [x] One-card fixed DFlash at `--ctx-size 65536` if VRAM allows

Then MTP:

- [x] One-card `--spec-type draft-mtp`, no DFlash
- [x] Confirm whether Gemma 4 31B GGUF has usable MTP metadata/heads
- [x] If MTP works, sweep `--spec-draft-n-max 1`, `2`, and `3`
- [x] Compare MTP against the one-card fixed DFlash champion
- [ ] MTP prompt sanity check with a less draft-friendly prompt
- [ ] MTP deeper sweep around the current best: `--spec-draft-n-max 6`, `12`, `16`
- [x] If MTP works well, test two-card tensor MTP because previous Qwen MTP results favored tensor split
- [ ] Retest champion DFlash with turbo/cache variants later, with `--no-mmproj`, to separate cache effect from mmproj overhead
- [x] Retest two-card tensor MTP stability with prompt cache disabled
- [x] Retest two-card tensor MTP stability with `-fa off` or confirm unsupported
- [x] Retest two-card tensor MTP stability with `-ctk f16 -ctv f16`
- [x] If BeeLlama was not built with RCCL, build/test `-DGGML_HIP_RCCL=ON` and run with `GGML_CUDA_ALLREDUCE=nccl`
- [x] Test target tensor split with MTP draft forced to one GPU
- [x] Test target tensor split with MTP draft CPU offload
