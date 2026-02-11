import type { HttpChain } from "@/components/httpchain/types/schema";

/**
 * Get all variables that can be used as dependencies for a step
 *
 * Rule: A variable is eligible as a dependency for a step ONLY if
 * none of the variables produced by that step are used in other steps' dependencies.
 *
 * This prevents circular dependencies and ensures a valid dependency graph.
 *
 * Includes:
 * - Chain variables (always available)
 * - Extractor keys from steps that don't create circular dependencies
 */
export function getAvailableDependencyVariables(
  workflow: HttpChain | null,
  currentStepNodeId: string,
): string[] {
  if (!workflow) return [];

  const available = new Set<string>();

  // Add chain variables (always available)
  if (workflow.chain_variables) {
    workflow.chain_variables.forEach((v) => available.add(v));
  }

  // Find current step
  const currentStep = workflow.steps.find(
    (s) => s.node_id === currentStepNodeId,
  );
  if (!currentStep) return Array.from(available).sort();

  // Get all variables produced by the current step
  const currentStepProducedVariables = new Set<string>();
  if (currentStep.request.extractors) {
    currentStep.request.extractors.forEach((extractor) => {
      currentStepProducedVariables.add(extractor.extractor_key);
    });
  }

  // Find all steps that depend on variables produced by the current step
  // If Step B depends on Step Current's variables, then Step Current cannot depend on Step B's variables
  const stepsThatDependOnCurrent = new Set<string>();
  workflow.steps.forEach((step) => {
    if (step.node_id === currentStepNodeId) return; // Skip current step

    if (step.depends_on_variables) {
      // Check if this step depends on any variable produced by current step
      const dependsOnCurrent = step.depends_on_variables.some((v) =>
        currentStepProducedVariables.has(v),
      );
      if (dependsOnCurrent) {
        stepsThatDependOnCurrent.add(step.node_id);
      }
    }
  });

  // Now, a variable is available if it's produced by a step that:
  // - Is NOT in the set of steps that depend on current step's variables
  workflow.steps.forEach((step) => {
    if (step.node_id === currentStepNodeId) return; // Skip current step
    if (stepsThatDependOnCurrent.has(step.node_id)) return; // Skip steps that depend on current step

    // Add all extractor keys from this step
    if (step.request.extractors) {
      step.request.extractors.forEach((extractor) => {
        available.add(extractor.extractor_key);
      });
    }
  });

  return Array.from(available).sort();
}

/**
 * Get all variables that CANNOT be used as extractor keys
 * This includes:
 * - Chain variables
 * - All dependency variables from all steps (since they're already used as dependencies)
 */
export function getForbiddenExtractorKeys(
  workflow: HttpChain | null,
): Set<string> {
  const forbidden = new Set<string>();

  if (!workflow) return forbidden;

  // Add chain variables
  if (workflow.chain_variables) {
    workflow.chain_variables.forEach((v) => forbidden.add(v));
  }

  // Add all dependency variables from all steps
  workflow.steps.forEach((step) => {
    if (step.depends_on_variables) {
      step.depends_on_variables.forEach((v) => forbidden.add(v));
    }
  });

  return forbidden;
}

/**
 * Get dependencies for a specific step by node_id
 */
export function getStepDependencies(
  workflow: HttpChain | null,
  stepNodeId: string,
): string[] {
  if (!workflow) return [];

  const step = workflow.steps.find((s) => s.node_id === stepNodeId);
  return step?.depends_on_variables || [];
}
