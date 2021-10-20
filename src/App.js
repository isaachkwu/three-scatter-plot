import './App.css';

// components
import ScatterPlot from './components/scatter-plot/ScatterPlot';

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
        node={nodes}
        branch={branches}
      />
    </div>
  );
}

export default App;
