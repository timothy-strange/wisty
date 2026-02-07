export default function StatusBar(props) {
  return (
    <div className="flex flex-row items-center h-8 px-2 border-t border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70 text-xs">
      <span className="ml-auto w-fit truncate font-thin text-gray-700 dark:text-gray-300">{props.statsText}</span>
    </div>
  );
}
