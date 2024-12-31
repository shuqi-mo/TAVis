import MonacoEditor from "react-monaco-editor";
import { useState } from "react";
import { Button, Flex } from "antd";

function CodeEditor({ code, onCodeChange}) {
  const [tempcode, setTempcode] = useState(null);

  const handleExecute = () => {
    onCodeChange(tempcode);
  };

  return (
    <div>
      <MonacoEditor
        width="500"
        height="500"
        language="javascript"
        value={code}
        onChange={(v)=>setTempcode(v)}
      />
      <Flex gap="small" wrap>
        <Button type="primary" onClick={() => handleExecute()}>
          execute
        </Button>
      </Flex>
    </div>
  );
}

export default CodeEditor;
