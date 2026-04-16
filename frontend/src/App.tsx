import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Team from './pages/Team';
import Projects from './pages/Projects';
import LegislationTracker from './pages/LegislationTracker';
import IncidentsTracker from './pages/IncidentsTracker';
import CaseStudies from './pages/CaseStudies';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import './styles/global.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="team" element={<Team />} />
          <Route path="projects" element={<Projects />} />
          <Route path="databases/legislation" element={<LegislationTracker />} />
          <Route path="databases/incidents" element={<IncidentsTracker />} />
          <Route path="databases/cases" element={<CaseStudies />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="contact" element={<Contact />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
