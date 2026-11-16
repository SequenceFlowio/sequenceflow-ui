import { Composition, Still } from "remotion";

import { ContentOne } from "./ContentOne";
import { Cover } from "./Cover";
import { PainPoints } from "./PainPoints";
import { SQUARE, SquareVideo } from "./Square";
import { Stock } from "./Stock";
import { SupportOne } from "./SupportOne";
import { TIP_DURATION, TipReel } from "./TipReel";
import { FPS, H, W } from "./theme";

export function Root() {
  return (
    <>
      <Composition id="SupportOne" component={SupportOne} durationInFrames={640} fps={FPS} width={W} height={H} />
      <Composition id="PainPoints" component={PainPoints} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="Stock" component={Stock} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="SupportOneEN" component={SupportOne} defaultProps={{ lang: "en" as const }} durationInFrames={640} fps={FPS} width={W} height={H} />
      <Composition id="PainPointsEN" component={PainPoints} defaultProps={{ lang: "en" as const }} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="StockEN" component={Stock} defaultProps={{ lang: "en" as const }} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="SupportOneSquare" component={SquareVideo} defaultProps={{ video: "SupportOne" as const, lang: "nl" as const }} durationInFrames={640} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="SupportOneENSquare" component={SquareVideo} defaultProps={{ video: "SupportOne" as const, lang: "en" as const }} durationInFrames={640} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="PainPointsSquare" component={SquareVideo} defaultProps={{ video: "PainPoints" as const, lang: "nl" as const }} durationInFrames={570} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="PainPointsENSquare" component={SquareVideo} defaultProps={{ video: "PainPoints" as const, lang: "en" as const }} durationInFrames={570} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="StockSquare" component={SquareVideo} defaultProps={{ video: "Stock" as const, lang: "nl" as const }} durationInFrames={570} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="StockENSquare" component={SquareVideo} defaultProps={{ video: "Stock" as const, lang: "en" as const }} durationInFrames={570} fps={FPS} width={SQUARE} height={SQUARE} />
      <Composition id="TipReel" component={TipReel} defaultProps={{ lang: "nl" as const, content: { hook1: "Minder retouren?", hook2: "Begin hier.", label: "3 tips voor je webshop", tips: [{ title: "Maattabel bij elk product", body: "De meeste retouren gaan over maat. Zet een duidelijke maattabel direct bij de knop." }, { title: "Echte foto's", body: "Laat het product zien zoals het is, ook van dichtbij en aan iemand." }, { title: "Antwoord snel", body: "Een snelle reactie op een twijfel voorkomt vaak een retour." }] } }} durationInFrames={TIP_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="ContentOne" component={ContentOne} durationInFrames={540} fps={FPS} width={W} height={H} />
      <Still id="CoverSupportOne" component={Cover} defaultProps={{ video: "SupportOne" as const, lang: "nl" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverSupportOneSquare" component={Cover} defaultProps={{ video: "SupportOne" as const, lang: "nl" as const, square: true }} width={1080} height={1080} />
      <Still id="CoverSupportOneEN" component={Cover} defaultProps={{ video: "SupportOne" as const, lang: "en" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverSupportOneENSquare" component={Cover} defaultProps={{ video: "SupportOne" as const, lang: "en" as const, square: true }} width={1080} height={1080} />
      <Still id="CoverPainPoints" component={Cover} defaultProps={{ video: "PainPoints" as const, lang: "nl" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverPainPointsSquare" component={Cover} defaultProps={{ video: "PainPoints" as const, lang: "nl" as const, square: true }} width={1080} height={1080} />
      <Still id="CoverPainPointsEN" component={Cover} defaultProps={{ video: "PainPoints" as const, lang: "en" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverPainPointsENSquare" component={Cover} defaultProps={{ video: "PainPoints" as const, lang: "en" as const, square: true }} width={1080} height={1080} />
      <Still id="CoverStock" component={Cover} defaultProps={{ video: "Stock" as const, lang: "nl" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverStockSquare" component={Cover} defaultProps={{ video: "Stock" as const, lang: "nl" as const, square: true }} width={1080} height={1080} />
      <Still id="CoverStockEN" component={Cover} defaultProps={{ video: "Stock" as const, lang: "en" as const, square: false }} width={1080} height={1920} />
      <Still id="CoverStockENSquare" component={Cover} defaultProps={{ video: "Stock" as const, lang: "en" as const, square: true }} width={1080} height={1080} />
    </>
  );
}
