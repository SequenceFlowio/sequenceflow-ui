import { Composition } from "remotion";

import { ContentOne } from "./ContentOne";
import { PainPoints } from "./PainPoints";
import { Stock } from "./Stock";
import { SupportOne } from "./SupportOne";
import { FPS, H, W } from "./theme";

export function Root() {
  return (
    <>
      <Composition id="SupportOne" component={SupportOne} durationInFrames={640} fps={FPS} width={W} height={H} />
      <Composition id="PainPoints" component={PainPoints} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="Stock" component={Stock} durationInFrames={570} fps={FPS} width={W} height={H} />
      <Composition id="ContentOne" component={ContentOne} durationInFrames={540} fps={FPS} width={W} height={H} />
    </>
  );
}
