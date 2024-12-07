import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';

import './style.css';
import { examples } from './examples';
import renderToCanvas from './renderToCanvas';


export function App() {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [count, setCount] = useState(0); // just to trigger canvas updates
  const signals = {
    bending: useSignal(0),
    vertices: useSignal(true),
    labels: useSignal(true),
    edges: useSignal(true),
    cuts: useSignal(true),
    faces: useSignal(true),
    breaks: useSignal(true),
    flower: useSignal(true),
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
        <button onClick={() => setCount(c => c+1)}>run task</button>
        {Object.entries(signals).map(([key, signal]) => <label>
          {key}
          {key === "bending"
          ? <input type="range" style="display: inline-block; vertical-align: middle;"
              min="0" max="1" step=".01" value={signals.bending.value.toFixed(2)}
              onInput={e => signals.bending.value = Number.parseFloat(e.currentTarget.value)}
            />
          : <input type="checkbox"
              checked={signals[key].value}
              onChange={() => { signals[key].value = !signals[key].value; }}
            />
          }
        </label>)}
      </div>
      <canvas ref={canvas}/>
    </div>
  );
}

render(<App />, document.getElementById('app'));
