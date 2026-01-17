// Quick test to verify models are loaded
const { customModelProvider } = require("./src/lib/ai/models.ts");

console.log("Available providers and models:");
console.log(JSON.stringify(customModelProvider.modelsInfo, null, 2));

console.log("\n\nModel counts by provider:");
customModelProvider.modelsInfo.forEach((provider) => {
  console.log(`${provider.provider}: ${provider.models.length} models`);
});
