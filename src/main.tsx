import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StaffDistribusi from './StaffDistribusi.tsx';
import './index.css';

const urlParams = new URLSearchParams(window.location.search);
const isStaffDistribusi = urlParams.get('staff') === 'distribusi';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStaffDistribusi ? <StaffDistribusi /> : <App />}
  </StrictMode>,
);
