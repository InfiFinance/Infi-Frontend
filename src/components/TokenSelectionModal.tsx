import { Modal } from 'antd';
import { Token } from '@/types/token';

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
  tokens: Token[];
}

export default function TokenSelectionModal({
  isOpen,
  onClose,
  onSelect,
  tokens
}: TokenSelectionModalProps) {
  return (
    <Modal
      open={isOpen}
      footer={null}
      onCancel={onClose}
      title="Select a token"
      className="font-sans"
      maskClosable={true}
      closeIcon={true}
    >
      <div className="border-t border-gray-700 mt-4 space-y-2">
        {tokens?.map((token, index) => (
          <div
            key={index}
            className="flex items-center p-3 hover:bg-gray-800 cursor-pointer rounded-lg"
            onClick={() => onSelect(index)}
          >
            <img src={token.img} alt={token.ticker} className="w-10 h-10" />
            <div className="ml-3">
              <div className="text-base font-medium">{token.name}</div>
              <div className="text-sm text-gray-400">{token.ticker}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}