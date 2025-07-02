import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Signal, useSignal } from '@preact/signals';
import JSON5 from 'json5';
import * as V from 'valibot';

import './style.css';
import { examples } from './examples';
import renderToCanvas, { Signals } from './renderToCanvas';
import { Grid3Background, grid3Backgrounds, grid3Features, Grid4Background, grid4Backgrounds, grid4Features, grids, GridType } from './tiling';
import { validateTask } from './validation';
import { Obj } from './utils';


const background3Names: Partial<Record<Grid3Background, string>> = {
  tile3a: "Alhambra tiles",
  tile3b: "Hexagonal tiles by n-gons",
}

const background4Names: Partial<Record<Grid4Background, string>> = {
  "tiles A": "Alhambra tiles A",
  "tiles B": "Alhambra tiles B",
  "tiles C": "Alhambra tiles C",
  "tiles D": "Escher-style lizards",
}

export function App() {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [task, setTask] = useState(examples[exampleIdx].value.trim());
  const [count, setCount] = useState(0); // just to trigger canvas updates
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  function emitWarning(warning: string) {
    setWarnings(warnings => [...warnings, warning]);
  }
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
    grid3: {
      background: useSignal("plain"),
      triangles: useSignal(true),
      diamonds: useSignal(false),
      hexagons1: useSignal(false),
      hexagons2: useSignal(false),
      arrows: useSignal(false),
      ball: useSignal(false),
      zigzag: useSignal(false),
    },
    grid4: {
      background: useSignal("plain"),
      quads: useSignal(true),
      "dual quads": useSignal(false),
      cairo1: useSignal(false),
      cairo2: useSignal(false),
    },
  };
  const canvas = useRef<HTMLCanvasElement>();

  useEffect(
    () => {
      setWarnings([]);
      let parsedTask: unknown;
      try {
        parsedTask = JSON5.parse(task);
      } catch (e) {
        setErrors(["Could not parse JSON5: " + e]);
        return;
      }
      const validity = validateTask(parsedTask);
      if (!validity.success) {
        setErrors(validity.issues.map(issue =>
          `${issue.message}\nPath: ${V.getDotPath(issue)}`
        ));
        return;
      }
      setErrors([]);
      try {
        return renderToCanvas(canvas.current, validity.output, signals, emitWarning);
      } catch (e) {
        setErrors([`Exception caught: ${e}`]);
      }
    }, [count],
  );

  function saveAndRun(text: string) {
    setTask(text);
    // Trigger a renderToCanvas.  (We do it indirectly so that
    // useEffect's cleanup calls take place.)
    setCount(c => c+1);
  }

  async function paste() {
    saveAndRun(await navigator.clipboard.readText());
  }

  const checkbox = (text: string, signal: Signal<boolean>) => (
    <label>
      {text + " "}
      <input type="checkbox"
        checked={signal}
        onChange={() => { signal.value = !signal.value; }}
      />
    </label>
  );
  return (<>
    <h1>Folding a Star to a Polyhedron</h1>
    <p>
      For a description of this demo see {}
      <a href="https://github.com/hcschuetz/polyhedron-star">the project README</a>.
    </p>
    <div class="rows">
      <textarea
        rows={20} spellcheck={false}
        value={task} onChange={e => setTask(e.currentTarget.value)}
      />
      {warnings.length > 0 && (
      <ul class="warnings">
        {warnings.map(issue => <li>{issue}</li>)}
      </ul>
      )}
      {errors.length > 0 && (
      <ul class="errors">
        {errors.map(issue => <li>{issue}</li>)}
      </ul>
      )}
      <div>
        Edit the spec above
        and <button onClick={() => setCount(c => c+1)}>run</button> it,
        select an example {}
        <select value={exampleIdx} onChange={e => {
          const idx = +e.currentTarget.value;
          setExampleIdx(idx);
          saveAndRun(examples[idx].value.trim());
        }}>
        {examples.map((ex, i) => (
          <option value={i}>
            {ex.name}
          </option>
        ))}
        </select>,
        or <button onClick={paste}>paste</button> from the clipboard.
      </div>
      <div class="flex-row">
        <span style={{textDecoration: "underline"}}>Display settings:</span>
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
            value={signals.bending}
            onInput={e => signals.bending.value = Number.parseFloat(e.currentTarget.value)}
          />
        </label>
        {checkbox("autobend", signals.autobend)}
        <label>
          {"grid "}
          <select value={signals.grid}
            onChange={e => signals.grid.value = e.currentTarget.value as GridType}
          >
            {Obj.keys(grids).map(key => (
              <option value={key}>{key}</option>
            ))}
          </select>
        </label>
        <label>
          density [{signals.density}]{" "}
          <input type="range" style="display: inline-block; vertical-align: middle;"
            min="1" max="5" step="1" value={signals.density}
            onInput={e => signals.density.value = Number.parseInt(e.currentTarget.value)}
          />
        </label>
      </div>
      {signals.grid.value.includes("triangular") &&
        <div className="flex-row">
          <span style={{textDecoration: "underline"}}>Triangular grid:</span>
          <label>background: <select
            value={signals.grid3.background}
            onChange={e => signals.grid3.background.value = e.currentTarget.value as Grid3Background}
          >
            {grid3Backgrounds.map(background =>
              <option value={background}>{background3Names[background] ?? background}</option>
            )}
          </select></label>
          {grid3Features.map(ft => checkbox(ft, signals.grid3[ft]))}
        </div>
      }
      {signals.grid.value.includes("quad") &&
        <div className="flex-row">
          <span style={{textDecoration: "underline"}}>Quad grid:</span>
          <label>background: <select
            value={signals.grid4.background}
            onChange={e => signals.grid4.background.value = e.currentTarget.value as Grid4Background}
          >
            {grid4Backgrounds.map(background =>
              <option value={background}>{background4Names[background] ?? background}</option>
            )}
          </select></label>
          {grid4Features.map(ft => checkbox(ft, signals.grid4[ft]))}
        </div>
      }
      <canvas ref={canvas}/>
    </div>
  </>);
}

render(<App />, document.getElementById('app'));
