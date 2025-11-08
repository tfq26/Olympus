// DockMenu.jsx
import React from 'react';
import { Dock } from 'primereact/dock';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

const DockMenu = ({ position = 'bottom' }) => {
  const items = [
    {
      label: 'Home',
      icon: 'pi pi-fw pi-home',
    },
    {
      label: 'Calendar',
      icon: 'pi pi-fw pi-calendar',
    },
    {
      label: 'Edit',
      icon: 'pi pi-fw pi-pencil',
    },
    {
      label: 'Documentation',
      icon: 'pi pi-fw pi-file',
    },
  ];

  return <Dock model={items} position={position} />;
};

export default DockMenu;
