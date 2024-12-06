import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import './style.css';
import { examples } from './examples';
import renderToCanvas from './renderToCanvas';


export function App() {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [count, setCount] = useState(0); // just to trigger canvas updates
  const textarea = useRef<HTMLTextAreaElement>();
  const canvas = useRef<HTMLCanvasElement>();

  useEffect(
    () => { textarea.current.value = examples[exampleIdx].value.trim(); },
    [exampleIdx]
  );
  useEffect(
    () => renderToCanvas(canvas.current, textarea.current.value),
    [count],
  );

  return (
    <div>
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
      <br />
      <textarea ref={textarea} cols={100} rows={20} />
      <br />
      <button onClick={() => setCount(c => c+1)}>run</button>
      <br />
      <canvas ref={canvas}/>
    </div>
  );
}

render(<App />, document.getElementById('app'));
