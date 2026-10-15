import { supplementCategories } from '../../../shared/features/catalog/supplement-categories.js'

export function ensureSupplementCategories(db) {
  return db.$transaction(async tx => {
    for (const category of supplementCategories) {
      await tx.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: { name: category.name, isActive: true },
      })
    }
  })
}
