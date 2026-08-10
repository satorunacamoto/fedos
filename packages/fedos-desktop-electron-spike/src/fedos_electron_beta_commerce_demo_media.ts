/**
 * Commerce Reachable Catalog Phase 1 — deterministic, repository-authored
 * demo product image (a generated diagonal gradient, deep violet -> warm
 * amber, 96x96 PNG). NOT a stock photo, NOT fetched from any network or
 * CDN, NOT a downloaded asset — generated once by a small local script
 * (zlib deflate + hand-built PNG chunks, see this arc's commit message)
 * and baked in here as a plain data: URI so the Catalog/Product Detail
 * screens have zero filesystem or network dependency to render it.
 *
 * Used ONLY for the one demo product intentionally shipped WITH an image
 * ("aurora-study"); every other demo product deliberately has no media,
 * to also exercise the missing-image fallback path.
 *
 * contentHash is sha256 of the exact decoded PNG bytes (same
 * canonical-bytes -> sha256 -> hex discipline as
 * computeFedosConversationArchiveContentHash(), reused here rather than
 * inventing a second hashing convention).
 */
export const FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY = {
  dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAADtElEQVR42u3Q53YTBAAF4Ps6gigIgiAIgiCYvVeTZu89m9BCoRQKpS0tLS3FgQMniFscOHAr7o0Dt/IWnpTfuU9wz/me4IPxho5pWce8rGNe3rYsb1tvbNtWtO0rBhw3dTlvHnCtbLlXtjyrWt5VLe8tTd/qpn91M7Cm2bemEby1EVzbCK1t9K+rh9fVI7fVo+vr0fW12IZafEMtcXstubGa2lhNbaqmN1Uzd1Symyu5zZXclkp+S7lwZ7m4tVzaWi5vK5W3lSp3larbS7XtxfqOYmNHsXF3sbmz0NpZGNhVaO8qdO7Jdwz53Yb8oDE/ZMztMeX2mruGLdl9lux+a3bElh2xZQ7YM6P2zEFH5pAzPeZMj7nSh13pI+7UuCd11JOa8KYmvMlJX3LKnzzmT04HEjOBxExf4ngwMRuMz4XiJ0Lx+f74fDi2EI6djMQWI7FT0Si0Q3bujUWhHbKzFKSd3jv3xaPQDtm5Px6BdsjOA4kItEN2Tici0A7ZOZ2MQDtk58FUGNohOw+lwtAO2Xk4HYZ2yM4j6TC0Q3bOZPqhHbJzJtsP7ZCdR7tB2um981iuH9ohO4/nQtAO2XkiH4J2yM6ThRC0Q3a6QdohO08Vg9AO2TlbDEI7ZOdcKQjtkJ2ny0Foh+ycL/dBO2TnfKUP2iE7zywFaafnzrPVPmiH7DxXC0A7ZOf5WgDaITsv1APQDtnpBmmH7LzY8EM7ZOelph/aITsvN/3QDtm50PJDO2TnQssH7ZCdVwZ80A7ZebXtg3bIzmttH7RDdl7veKEdsnOx44V2yM7F3V5oh+y8MbgUpJ1eO28OeqAdsvPWkAfaITtvD3mgHbJzaY8H2iE7l/a6oR2y8043SDu9d94ddkM7ZOe9YTe0Q3be3+eCdsjOB/td0A7Z6QZph+x8OOKCdsjORyNOaIfsfHzACe2QnU9GndAO2bk86oR2yM7lgw5oh+x8ej1IO712PjvkgHbIzudjDmiH7HwxZod2yM6Xh+3QDtm5HqSdnjtfHbFDO2Tn63EbtEN2vhm3QTtk59ujNmiH7HSDtEN2vpuwQjtk5/tJK7RDdn6YtEI7ZOfHKSu0Q3auTFmgHbJz5ZgF2iE7P013g7TTc+fnaQu0Q3Z+mTFDO2Tn1xkztEN2rh43Qztk5+qsGdohO7/NmqAdsvP7nAnaITt/zJmgHbLz5wkTtEN2/po3QjtkpxukHbLz94IR2iE7/ywYoR2y8+9JA7RDdv5bNEA7ZOfaogHaITvXThn+B1D1XYkMPMyUAAAAAElFTkSuQmCC",
  mimeType: "image/png",
  contentHash: "ae914714866edcb674acf7aceada90a46841984add3f1575886fabe7f6df0bd4",
  sizeBytes: 1005,
  altText: "Deep violet to warm amber gradient study — synthetic demo artwork, no real artist or artwork depicted.",
} as const;
