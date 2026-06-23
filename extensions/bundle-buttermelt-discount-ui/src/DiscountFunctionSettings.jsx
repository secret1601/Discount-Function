import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";

export default () => {
  render(<App />, document.body);
};

function App() {
  const {
    applyExtensionMetafieldChange,
    topCollections,
    bottomCollections,
    discountPercentage,
    discountMessage,
    onDiscountPercentageChange,
    onDiscountMessageChange,
    onSelectTopCollections,
    onSelectBottomCollections,
    removeTopCollection,
    removeBottomCollection,
    resetForm,
    loading,
  } = useExtensionData();

  if (loading) {
    return <s-text>Loading...</s-text>;
  }

  return (
    <s-function-settings
      onSubmit={event => {
        event.waitUntil?.(applyExtensionMetafieldChange());
      }}
      onReset={resetForm}
    >
      <s-heading>ButterMelt™ Bundle Set Discount</s-heading>

      <s-section>
        <s-text-field
          label="Discount Message"
          name="discountMessage"
          value={discountMessage}
          defaultValue="Set 10% OFF"
          onChange={event => onDiscountMessageChange(event.currentTarget.value)}
        />
      </s-section>

      <s-section>
        <s-number-field
          label="Discount Percentage"
          name="discountPercentage"
          value={String(discountPercentage)}
          defaultValue="10"
          min={0}
          max={100}
          onChange={event => onDiscountPercentageChange(event.currentTarget.value)}
          suffix="%"
        />
      </s-section>

      <s-section>
        <s-stack gap="base">
          <s-text emphasis="bold">Top Collection (Set - Top)</s-text>
          <s-button onClick={onSelectTopCollections}>Select Top Collection</s-button>
          {topCollections.map(col => (
            <s-stack direction="inline" alignItems="center" justifyContent="space-between" key={col.id}>
              <s-link href={`shopify://admin/collections/${col.id.split("/").pop()}`} target="_blank">
                {col.title}
              </s-link>
              <s-button variant="tertiary" onClick={() => removeTopCollection(col.id)}>
                <s-icon type="x-circle" />
              </s-button>
            </s-stack>
          ))}
        </s-stack>
      </s-section>

      <s-section>
        <s-stack gap="base">
          <s-text emphasis="bold">Bottom Collection (Set - Bottom)</s-text>
          <s-button onClick={onSelectBottomCollections}>Select Bottom Collection</s-button>
          {bottomCollections.map(col => (
            <s-stack direction="inline" alignItems="center" justifyContent="space-between" key={col.id}>
              <s-link href={`shopify://admin/collections/${col.id.split("/").pop()}`} target="_blank">
                {col.title}
              </s-link>
              <s-button variant="tertiary" onClick={() => removeBottomCollection(col.id)}>
                <s-icon type="x-circle" />
              </s-button>
            </s-stack>
          ))}
        </s-stack>
      </s-section>
    </s-function-settings>
  );
}

function useExtensionData() {
  const { applyMetafieldChange, data, resourcePicker, query } = shopify;

  const metafieldConfig = useMemo(
    () => parseMetafield(
      data?.metafields?.find(m => m.key === "function-configuration")?.value
    ),
    [data?.metafields],
  );

  const [discountMessage, setDiscountMessage] = useState(metafieldConfig.discountMessage);
  const [discountPercentage, setDiscountPercentage] = useState(metafieldConfig.discountPercentage);
  const [topCollections, setTopCollections] = useState([]);
  const [bottomCollections, setBottomCollections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      const [tops, bottoms] = await Promise.all([
        getCollections(metafieldConfig.topCollectionIds, query),
        getCollections(metafieldConfig.bottomCollectionIds, query),
      ]);
      setTopCollections(tops);
      setBottomCollections(bottoms);
      setLoading(false);
    };
    fetchCollections();
  }, []);

  const onDiscountPercentageChange = (value) => setDiscountPercentage(Number(value));
  const onDiscountMessageChange = (value) => setDiscountMessage(value);

  const onSelectTopCollections = async () => {
    const selection = await resourcePicker({
      type: "collection",
      selectionIds: topCollections.map(({id}) => ({id})),
      action: "select",
      multiple: true,
    });
    if (selection) setTopCollections(selection);
  };

  const onSelectBottomCollections = async () => {
    const selection = await resourcePicker({
      type: "collection",
      selectionIds: bottomCollections.map(({id}) => ({id})),
      action: "select",
      multiple: true,
    });
    if (selection) setBottomCollections(selection);
  };

  const removeTopCollection = (id) => setTopCollections(prev => prev.filter(c => c.id !== id));
  const removeBottomCollection = (id) => setBottomCollections(prev => prev.filter(c => c.id !== id));

  async function applyExtensionMetafieldChange() {
    await applyMetafieldChange({
      type: "updateMetafield",
      namespace: "bundle-discount",
      key: "function-configuration",
      value: JSON.stringify({
        discountPercentage,
        discountMessage,
        topCollectionIds: topCollections.map(({id}) => id),
        bottomCollectionIds: bottomCollections.map(({id}) => id),
      }),
      valueType: "json",
    });
  }

  const resetForm = () => {
    setDiscountPercentage(metafieldConfig.discountPercentage);
    setDiscountMessage(metafieldConfig.discountMessage);
  };

  return {
    applyExtensionMetafieldChange,
    topCollections,
    bottomCollections,
    discountPercentage,
    discountMessage,
    onDiscountPercentageChange,
    onDiscountMessageChange,
    onSelectTopCollections,
    onSelectBottomCollections,
    removeTopCollection,
    removeBottomCollection,
    resetForm,
    loading,
  };
}

function parseMetafield(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return {
      discountMessage: parsed.discountMessage ?? "Set 10% OFF",
      discountPercentage: Number(parsed.discountPercentage ?? 10),
      topCollectionIds: parsed.topCollectionIds ?? [],
      bottomCollectionIds: parsed.bottomCollectionIds ?? [],
    };
  } catch {
    return {
      discountMessage: "Set 10% OFF",
      discountPercentage: 10,
      topCollectionIds: [],
      bottomCollectionIds: [],
    };
  }
}

async function getCollections(collectionGids, adminApiQuery) {
  if (!collectionGids?.length) return [];
  const result = await adminApiQuery(
    `#graphql
      query GetCollections($ids: [ID!]!) {
        collections: nodes(ids: $ids) {
          ... on Collection {
            id
            title
          }
        }
      }
    `,
    { variables: { ids: collectionGids } },
  );
  return result?.data?.collections ?? [];
}
