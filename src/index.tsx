import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import './style.css';
import { examples } from './examples';
import renderToCanvas from './renderToCanvas';


export function App() {
  const [exampleIdx, setExampleIdx] = useState(0)
  const textarea = useRef<HTMLTextAreaElement>();
  const canvas = useRef<HTMLCanvasElement>();

  function run() { renderToCanvas(canvas.current, textarea.current.value); }

  useEffect(run, []);

  return (
    <div>
      <select value={exampleIdx} onChange={e => setExampleIdx(+e.target["value"])}>
        {examples.map((ex, i) => (
          <option value={i}>
            {ex.name}
          </option>
        ))}
        </select>
      <br />
      <textarea ref={textarea} cols={100} rows={20}>
        {examples[exampleIdx].value.trim()}
      </textarea>
      <br />
      <button onClick={run}>run</button>
      <br />
      <canvas ref={canvas}/>
    </div>
  );
}

render(<App />, document.getElementById('app'));
