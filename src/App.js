import './App.css';

// components
import ScatterPlot from './components/scatter-plot';

// data
import testData from './data/testdata-10.json'
import RealData from './data/100k_trial.json'

// data v2
import nodes from './data/100k_trial_nodes.json';
import branches from './data/100k_trial_branches.json';


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
        // id={RealData.id}
        // x={RealData.x}
        // y={RealData.y}
        // group={RealData.group}

        // data v2
        node={nodes}
        branch={branches}
      />
    </div>
  );
}

export default App;
