import MonacoEditor from "react-monaco-editor";
import { useState } from "react";
import { Button, Flex } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";

function CodeEditor({ code, onCodeChange }) {
  const [tempcode, setTempcode] = useState(null);

  const handleExecute = () => {
    onCodeChange(tempcode);
  };

  const options = {
    fontSize: 12,
    lineNumbersMinChars: 3,
    lineHeight: 14,
    minimap: {
      enabled: false, // 关闭迷你地图
    },
  };

  return (
    <Flex gap="small" vertical>
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        onClick={() => handleExecute()}
      >
        Update Code
      </Button>
      <MonacoEditor
        width="350"
        height="750"
        language="javascript"
        options={options}
        value={code}
        onChange={(v) => setTempcode(v)}
      />
    </Flex>
  );
}

export default CodeEditor;
