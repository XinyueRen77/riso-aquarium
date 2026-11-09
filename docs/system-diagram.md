# System Diagram

Grey = deterministic (code). Pink = probabilistic (the model). Dashed = what the model never sees.

```mermaid
flowchart LR
  U([Customer types a wish]) --> H[Chat history<br/>browser]
  H --> S[api/chat.js<br/>adds system instructions<br/>+ knowledge<br/>model + temperature]
  K[(Knowledge<br/>inks · taste rules<br/>catalog · schema)] --> S
  I[(System instructions<br/>role · rules · boundaries)] --> S
  S --> M{{LLM via OpenRouter<br/>Claude Haiku 5.5<br/>next-token completion}}
  M --> J[JSON reply<br/>reply · stage · scene]
  J --> V[Validator<br/>≤3 inks · catalog only<br/>counts · tones]
  V -->|fixes| LOG[Press log]
  V --> P[3D riso press<br/>three.js scene → ink coverage<br/>halftone per drum<br/>multiply + misregister<br/>animation]
  J --> C[Chat bubble]
  P --> PR[Proof strip<br/>before / after]
  PR --> U
  C --> U
  P -. never sent back .-> M
  LOG -. model is not told .-> M

  classDef det fill:#eee,stroke:#555,color:#111
  classDef prob fill:#ff48b0,stroke:#a0005a,color:#fff
  class H,S,K,I,V,P,LOG,PR,C det
  class M,J prob
```

**Human judgment:** the customer decides when a proof is final and whether to keep incompatible creatures.
