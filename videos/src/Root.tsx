import { Composition } from "remotion";

import { ContentOne } from "./ContentOne";
import { PainPoints } from "./PainPoints";
import { SQUARE, SquareVideo } from "./Square";
import { Stock } from "./Stock";
import { SupportOne } from "./SupportOne";
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
      <Composition id="ContentOne" component={ContentOne} durationInFrames={540} fps={FPS} width={W} height={H} />
    </>
  );
}
