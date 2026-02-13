import { customModelProvider } from "lib/ai/models";
import { getCurrentUser, canUserAccessModel } from "lib/auth/rbac-guards";
import { getAllModelPricing } from "lib/admin/billing-repository";

export const GET = async () => {
  const user = await getCurrentUser();

  // Unauthenticated users still get model list (for login page etc.)
  // but we'll filter by tier if authenticated
  let modelPricingMap: Map<
    string,
    { isPartnerOnly: boolean; minimumPlan: string }
  > | null = null;

  if (user) {
    try {
      const allPricing = await getAllModelPricing();
      modelPricingMap = new Map();
      for (const p of allPricing) {
        // Key is "provider/model" to match the models info structure
        modelPricingMap.set(`${p.provider}/${p.model}`, {
          isPartnerOnly: p.isPartnerOnly,
          minimumPlan: p.minimumPlan,
        });

        // Also map by just model name for loose matching
        modelPricingMap.set(p.model, {
          isPartnerOnly: p.isPartnerOnly,
          minimumPlan: p.minimumPlan,
        });
      }
    } catch {
      // If pricing DB not set up, serve all models
      modelPricingMap = null;
    }
  }

  const allModels = customModelProvider.modelsInfo.sort((a, b) => {
    if (a.hasAPIKey && !b.hasAPIKey) return -1;
    if (!a.hasAPIKey && b.hasAPIKey) return 1;
    return 0;
  });

  // If no user or no pricing config, return all models
  if (!user || !modelPricingMap || modelPricingMap.size === 0) {
    return Response.json(allModels);
  }

  // Filter models based on user's plan tier
  const filteredModels = allModels
    .map((providerGroup) => {
      const filteredProviderModels = providerGroup.models.filter((model) => {
        const pricingKey = `${providerGroup.provider}/${model.name}`;
        const pricing =
          modelPricingMap!.get(pricingKey) || modelPricingMap!.get(model.name);

        // If no pricing entry configured for this model, allow it (backwards compat)
        if (!pricing) return true;

        return canUserAccessModel(user, pricing);
      });

      return {
        ...providerGroup,
        models: filteredProviderModels,
      };
    })
    .filter((pg) => pg.models.length > 0);

  return Response.json(filteredModels);
};
