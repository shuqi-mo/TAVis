import MonacoEditor from "react-monaco-editor";
import { useState } from "react";
import { PlayCircleFilled } from "@ant-design/icons";

function CodeEditor({ code, onCodeChange }) {
  const [tempcode, setTempcode] = useState(null);

  const handleExecute = () => {
    onCodeChange(tempcode);
  };

  const options = {
    fontSize: 10,
    lineNumbersMinChars: 3,
    lineHeight: 12,
    minimap: {
      enabled: false, // 关闭迷你地图
    },
  };

  return (
    <div>
      <div className="view-title">
        Code Editor <PlayCircleFilled onClick={() => handleExecute()} />
      </div>
      <MonacoEditor
        width="280"
        height="350"
        language="javascript"
        options={options}
        value={code}
        onChange={(v) => setTempcode(v)}
      />
    </div>
  );
}

export default CodeEditor;
