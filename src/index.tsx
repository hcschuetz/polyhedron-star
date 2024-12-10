import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Signal, useSignal } from '@preact/signals';

import './style.css';
import { examples } from './examples';
import renderToCanvas, { grids, GridType, Signals } from './renderToCanvas';


export function App() {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [count, setCount] = useState(0); // just to trigger canvas updates
  const signals: Signals = {
    vertices: useSignal(false),
    labels: useSignal(true),
    edges: useSignal(true),
    cuts: useSignal(true),
    faces: useSignal(true),
    breaks: useSignal(true),
    flower: useSignal(false),
    bending: useSignal(0),
    autobend: useSignal(false),
    grid: useSignal("triangular even"),
    density: useSignal(1),
  };
  const textarea = useRef<HTMLTextAreaElement>();
  const canvas = useRef<HTMLCanvasElement>();

  useEffect(
    () => { textarea.current.value = examples[exampleIdx].value.trim(); },
    [exampleIdx]
  );
  useEffect(
    () => renderToCanvas(canvas.current, textarea.current.value, signals),
    [count],
  );

  const checkbox = (text: string, signal: Signal<boolean>) => (
    <label>
      {text}
      <input type="checkbox"
        checked={signal.value as boolean}
        onChange={() => { signal.value = !signal.value; }}
      />
    </label>
  );
  return (
    <div class="rows">
      <div class="flex-row">
        <label>
          Edit the task below or select an example: {}
          <select value={exampleIdx} onChange={e => {
            setExampleIdx(+e.target["value"]);
            // Trigger a renderToCanvas.  (We call it indirectly so that
            // useEffect's cleanup calls take place.)
            setCount(c => c+1);
          }}>
          {examples.map((ex, i) => (
            <option value={i}>
              {ex.name}
            </option>
          ))}
          </select>
        </label>
      </div>
      <textarea ref={textarea} rows={20} />
      <div class="flex-row">
        <button onClick={() => setCount(c => c+1)}>run</button>
        {checkbox("vertices", signals.vertices)}
        {checkbox("labels", signals.labels)}
        {checkbox("edges", signals.edges)}
        {checkbox("cuts", signals.cuts)}
        {checkbox("faces", signals.faces)}
        {checkbox("breaks", signals.breaks)}
        {checkbox("flower", signals.flower)}
        <label>
          {"bending "}
          <input type="range" style="display: inline-block; vertical-align: middle;"
            min="0" max="1" step=".01"
            value={(signals.bending.value as number).toFixed(2)}
            onInput={e => signals.bending.value = Number.parseFloat(e.currentTarget.value)}
          />
        </label>
        {checkbox("autobend", signals.autobend)}
        <label>
          {"grid "}
          <select value={signals.grid.value as GridType}
            onChange={e => signals.grid.value = e.currentTarget.value as GridType}
          >
            {Object.keys(grids).map(key => (
              <option value={key}>{key}</option>
            ))}
          </select>
        </label>
        <label>
          density [{signals.density.value}]{" "}
          <input type="range" style="display: inline-block; vertical-align: middle;"
            min="1" max="5" step="1" value={signals.density.value.toString()}
            onInput={e => signals.density.value = Number.parseInt(e.currentTarget.value)}
          />
        </label>
      </div>
      <canvas ref={canvas}/>
    </div>
  );
}

render(<App />, document.getElementById('app'));
