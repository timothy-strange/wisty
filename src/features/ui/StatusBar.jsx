import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

const ellipsis = "...";

const createTextMeasurer = () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  return (text, font) => {
    if (!context) {
      return text.length * 7;
    }
    context.font = font;
    return context.measureText(text).width;
  };
};

const middleEllipsize = (text, maxWidth, font, measure) => {
  if (!text || maxWidth <= 0) {
    return "";
  }

  if (measure(text, font) <= maxWidth) {
    return text;
  }

  const ellipsisWidth = measure(ellipsis, font);
  if (ellipsisWidth >= maxWidth) {
    return ellipsis;
  }

  let low = 1;
  let high = text.length;
  let best = ellipsis;

  while (low <= high) {
    const keepCount = Math.floor((low + high) / 2);
    const leftCount = Math.ceil(keepCount / 2);
    const rightCount = Math.floor(keepCount / 2);
    const candidate = `${text.slice(0, leftCount)}${ellipsis}${text.slice(text.length - rightCount)}`;
    if (measure(candidate, font) <= maxWidth) {
      best = candidate;
      low = keepCount + 1;
    } else {
      high = keepCount - 1;
    }
  }

  return best;
};

export default function StatusBar(props) {
  const [displayPath, setDisplayPath] = createSignal(props.filePath || "Untitled");
  const measureText = createTextMeasurer();
  let pathContainer;
  let resizeObserver;
  let frameId = 0;

  const recomputePath = () => {
    const rawPath = props.filePath || "Untitled";
    if (!pathContainer) {
      setDisplayPath(rawPath);
      return;
    }
    const width = pathContainer.clientWidth;
    const style = window.getComputedStyle(pathContainer);
    const font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;
    setDisplayPath(middleEllipsize(rawPath, width, font, measureText));
  };

  const scheduleRecompute = () => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      recomputePath();
    });
  };

  onMount(() => {
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleRecompute();
      });
      if (pathContainer) {
        resizeObserver.observe(pathContainer);
      }
    }
    scheduleRecompute();
  });

  createEffect(() => {
    props.filePath;
    props.statsText;
    props.showStats;
    props.fontSize;
    scheduleRecompute();
  });

  onCleanup(() => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  return (
    <div className="flex flex-row items-center h-8 px-2 gap-2 border-t border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70" style={{ "font-size": `${props.fontSize || 12}px` }}>
      <div ref={pathContainer} className="min-w-0 flex-1 text-left text-gray-700 dark:text-gray-300" title={props.filePath || "Untitled"}>
        <span className="block overflow-hidden whitespace-nowrap">{displayPath()}</span>
      </div>
      {props.showStats ? <span className="shrink-0 font-thin text-gray-700 dark:text-gray-300">{props.statsText}</span> : null}
    </div>
  );
}
