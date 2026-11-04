/** Self-authored regression SVGs; supplied/local assets never enter this repository. */
export const svgFixtures = [
  {
    name: "known-good-primitives",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="5" y="5" width="30" height="20" fill="#4477bb" stroke="none"/><circle cx="70" cy="70" r="20" fill="red" stroke="none"/><polygon points="10,50 40,50 25,80" fill="green" stroke="none"/></svg>',
  },
  {
    name: "known-good-translation",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g transform="translate(10 15)"><rect x="5" y="5" width="30" height="20" fill="#4477bb" stroke="none"/></g></svg>',
  },
  {
    name: "transparent-hole",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="#f35" d="M5 5H95V95H5Z M25 25V75H75V25Z"/></svg>',
  },
  {
    name: "evenodd-overlap",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="5" y="5" width="90" height="90" fill="#37b"/><path fill="#f35" fill-opacity="0.4" fill-rule="evenodd" d="M10 10H60V80H10Z M40 20H90V90H40Z"/></svg>',
  },
  {
    name: "inherited-lines",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="none" stroke="currentColor" color="#d24" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"><line x1="10" y1="10" x2="90" y2="90"/><path d="M10 80Q50 5 90 80"/></svg>',
  },
  {
    name: "opacity",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="red" opacity="0.5"/></svg>',
  },
  {
    name: "group-opacity-approximation",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g opacity="0.5"><rect x="5" y="5" width="60" height="60" fill="red"/><rect x="30" y="30" width="60" height="60" fill="blue"/></g></svg>',
  },
];
