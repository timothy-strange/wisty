export const minimalButton = "disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-transparent text-black ring-transparent hover:ring-gray-200 hover:bg-gray-100 active:bg-gray-200 active:ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-white dark:hover:ring-gray-700 dark:hover:bg-gray-800 dark:active:bg-gray-700 dark:active:ring-gray-700 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800";

export const colouredButton = (colour) => `disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-${colour}-500 text-white ring-${colour}-600 hover:shadow-${colour}-600 active:bg-${colour}-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:bg-${colour}-700 dark:ring-${colour}-600 dark:hover:shadow-${colour}-600 dark:active:bg-${colour}-600 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800`;

export const headerTextColour = "!text-gray-700 dark:!text-gray-300 select-none truncate";
export const menuButton = "rounded px-2 py-1 text-sm font-normal select-none text-black hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700";
export const menuItem = "w-full text-left px-3 py-1.5 text-sm text-black hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 flex items-center justify-between gap-6";
export const menuRowTight = "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-sm text-black dark:text-white";
export const menuArrow = "flex h-6 w-6 items-center justify-center rounded bg-gray-200/80 text-gray-700 hover:bg-gray-300 active:bg-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500";
export const menuPanel = "absolute left-0 top-full mt-0 w-max rounded border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 flex flex-col z-50";
export const menuShortcut = "text-sm text-gray-400 dark:text-gray-500";
