type StatusBarProps = {
  filePath: string;
  fileName: string;
  isDirty: boolean;
};

export const StatusBar = (props: StatusBarProps) => (
  <footer class="status-bar">
    <div class="status-left" title={props.filePath || props.fileName}>
      <span>{props.fileName}</span>
      {props.isDirty ? <span class="status-dirty">Modified</span> : null}
    </div>
  </footer>
);
