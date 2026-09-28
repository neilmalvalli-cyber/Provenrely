/** SafeSend on MST Testnet — placeholder ABI matching the agreed interface. */
export const safeSendAbi = [
  { type: "function", name: "send", stateMutability: "payable", inputs: [{ name: "to", type: "address" }], outputs: [] },
  { type: "error", name: "RecipientFlagged", inputs: [{ name: "to", type: "address" }] },
] as const;
