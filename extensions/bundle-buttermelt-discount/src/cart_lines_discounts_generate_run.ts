import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

function parseConfig(value: string | undefined) {
  try {
    const parsed = JSON.parse(value || '{}');
    return {
      discountMessage: parsed.discountMessage ?? 'Set 10% OFF',
      discountPercentage: Number(parsed.discountPercentage ?? 10),
      topCollectionIds: (parsed.topCollectionIds ?? []) as string[],
      bottomCollectionIds: (parsed.bottomCollectionIds ?? []) as string[],
    };
  } catch {
    return {
      discountPercentage: 10,
      topCollectionIds: [] as string[],
      bottomCollectionIds: [] as string[],
    };
  }
}


export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  const config = parseConfig(input.discount.metafield?.value);

  if (!config.topCollectionIds.length || !config.bottomCollectionIds.length) {
    return { operations: [] };
  }

  const topLines = input.cart.lines.filter(line =>
    line.merchandise.__typename === 'ProductVariant' &&
    line.merchandise.product.inCollections.some(
      (c: any) => config.topCollectionIds.includes(c.collectionId) && c.isMember
    )
  );

  const bottomLines = input.cart.lines.filter(line =>
    line.merchandise.__typename === 'ProductVariant' &&
    line.merchandise.product.inCollections.some(
      (c: any) => config.bottomCollectionIds.includes(c.collectionId) && c.isMember
    )
  );


  const topQty = topLines.reduce((sum, l) => sum + l.quantity, 0);
  const bottomQty = bottomLines.reduce((sum, l) => sum + l.quantity, 0);
  const setCount = Math.min(topQty, bottomQty);

  if (setCount === 0) {
    return { operations: [] };
  }

  const targets = [];
  let remaining = setCount;

  for (const line of topLines) {
    if (remaining <= 0) break;
    const qty = Math.min(line.quantity, remaining);
    targets.push({ cartLine: { id: line.id, quantity: qty } });
    remaining -= qty;
  }

  remaining = setCount;
  for (const line of bottomLines) {
    if (remaining <= 0) break;
    const qty = Math.min(line.quantity, remaining);
    targets.push({ cartLine: { id: line.id, quantity: qty } });
    remaining -= qty;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: config.discountMessage,
              targets,
              value: {
                percentage: {
                  value: config.discountPercentage,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
