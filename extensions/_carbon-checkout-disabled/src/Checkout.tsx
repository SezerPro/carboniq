import { useState, useEffect, useCallback } from "react";
import {
  reactExtension,
  useApi,
  Banner,
  BlockStack,
  InlineStack,
  Checkbox,
  Text,
  Heading,
  Divider,
} from "@shopify/ui-extensions-react/checkout";

const CO2_PER_KG_PRODUCT = 2.0;
const COST_PER_KG_CO2 = 0.12;
const KM_CAR_PER_KG_CO2 = 6.0;

interface OffsetProject {
  id: string;
  label: string;
  emoji: string;
  extraCost: number;
}

const OFFSET_PROJECTS: OffsetProject[] = [
  { id: "carbon", label: "Carbone", emoji: "\u{1F33F}", extraCost: 0 },
  { id: "tree", label: "Arbre", emoji: "\u{1F333}", extraCost: 0.8 },
  { id: "ocean", label: "Oc\u00e9an", emoji: "\u{1F30A}", extraCost: 0.3 },
];

interface CarbonData {
  co2Kg: number;
  baseCost: number;
  carKmEquivalent: number;
}

function Extension() {
  const api = useApi<"purchase.checkout.block.render">();
  const [enabled, setEnabled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("carbon");
  const [carbonData, setCarbonData] = useState<CarbonData>({
    co2Kg: 0,
    baseCost: 0,
    carKmEquivalent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCarbonData() {
      try {
        const lines = api.lines?.current ?? [];
        const totalItems = lines.reduce(
          (sum: number, line: any) => sum + (line.quantity ?? 1),
          0
        );
        const estimatedWeight = Math.max(totalItems, 1) * CO2_PER_KG_PRODUCT;

        try {
          const response = await fetch("/api/offset-calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemCount: totalItems,
              estimatedWeightKg: estimatedWeight,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setCarbonData({
              co2Kg: data.co2Kg ?? estimatedWeight,
              baseCost: data.baseCost ?? estimatedWeight * COST_PER_KG_CO2,
              carKmEquivalent:
                data.carKmEquivalent ?? estimatedWeight * KM_CAR_PER_KG_CO2,
            });
            setLoading(false);
            return;
          }
        } catch {
          // API not available, use local calculation
        }

        setCarbonData({
          co2Kg: estimatedWeight,
          baseCost: parseFloat((estimatedWeight * COST_PER_KG_CO2).toFixed(2)),
          carKmEquivalent: parseFloat(
            (estimatedWeight * KM_CAR_PER_KG_CO2).toFixed(1)
          ),
        });
      } catch {
        setCarbonData({
          co2Kg: 4.0,
          baseCost: 0.48,
          carKmEquivalent: 24.0,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchCarbonData();
  }, [api.lines]);

  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked);
  }, []);

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProject(projectId);
  }, []);

  const currentProject = OFFSET_PROJECTS.find((p) => p.id === selectedProject);
  const totalCost = carbonData.baseCost + (currentProject?.extraCost ?? 0);

  if (loading) {
    return (
      <Banner status="info">
        <Text>Calcul de l&apos;empreinte carbone...</Text>
      </Banner>
    );
  }

  return (
    <BlockStack spacing="base">
      <Banner status="success" title="Carboniq">
        <BlockStack spacing="base">
          <Heading level={3}>
            Compensez l&apos;empreinte carbone de votre commande
          </Heading>

          <InlineStack spacing="tight" blockAlignment="center">
            <Text size="small" appearance="subdued">
              Empreinte estim\u00e9e : {carbonData.co2Kg.toFixed(1)} kg CO\u2082
            </Text>
            <Text size="small" appearance="subdued">
              {" "}={" "}
              {carbonData.carKmEquivalent.toFixed(0)} km en voiture
            </Text>
          </InlineStack>

          <Divider />

          <Checkbox checked={enabled} onChange={handleToggle}>
            <Text emphasis="bold">
              Compenser l&apos;empreinte carbone de cette commande
            </Text>
          </Checkbox>

          {enabled && (
            <BlockStack spacing="base">
              <Divider />

              <BlockStack spacing="tight">
                <InlineStack spacing="base" blockAlignment="center">
                  <Text size="large" emphasis="bold">
                    {carbonData.co2Kg.toFixed(1)} kg CO\u2082
                  </Text>
                  <Text size="small" appearance="subdued">
                    = {carbonData.carKmEquivalent.toFixed(0)} km en voiture
                  </Text>
                </InlineStack>
              </BlockStack>

              <BlockStack spacing="tight">
                <Text size="small" emphasis="bold">
                  Choisissez votre projet :
                </Text>

                {OFFSET_PROJECTS.map((project) => {
                  const isSelected = selectedProject === project.id;
                  const projectCost = carbonData.baseCost + project.extraCost;

                  return (
                    <Checkbox
                      key={project.id}
                      checked={isSelected}
                      onChange={() => handleProjectSelect(project.id)}
                    >
                      <InlineStack spacing="tight" blockAlignment="center">
                        <Text emphasis={isSelected ? "bold" : undefined}>
                          {project.emoji} {project.label}
                        </Text>
                        <Text
                          size="small"
                          appearance={isSelected ? undefined : "subdued"}
                        >
                          {project.extraCost > 0
                            ? `(+${project.extraCost.toFixed(2)}\u20AC)`
                            : ""}
                        </Text>
                      </InlineStack>
                    </Checkbox>
                  );
                })}
              </BlockStack>

              <Divider />

              <InlineStack
                spacing="base"
                inlineAlignment="end"
                blockAlignment="center"
              >
                <Text size="large" emphasis="bold">
                  +{totalCost.toFixed(2)}\u20AC
                </Text>
              </InlineStack>

              <Text size="small" appearance="subdued">
                En activant cette option, vous contribuez directement \u00e0 un
                projet certifi\u00e9 de compensation carbone.
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </Banner>
    </BlockStack>
  );
}

export default reactExtension(
  "purchase.checkout.block.render",
  () => <Extension />
);
