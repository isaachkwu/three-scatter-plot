import './App.css';

// components
import ScatterPlot from './components/scatter-plot';

// data
import testData from './data/testdata-10.json'
import RealData from './data/100k_trial.json'

function App() {
  return (
    <div className="App">
      <ScatterPlot 
        // test 10
        // id={testData.id}
        // x={testData.x}
        // y={testData.y}
        // group={testData.group}

        // real mil test
        id={RealData.id}
        x={RealData.x}
        y={RealData.y}
        group={RealData.group}
      />
    </div>
  );
}

export default App;
