/* @refresh reload */
import { render } from 'solid-js/web';
import "tailwindcss/tailwind.css";
import './index.css';
import Wisty from './Wisty.jsx';

render(
  () => <Wisty/>, 
  document.getElementById('root')
);
