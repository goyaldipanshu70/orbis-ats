
import { Brain, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Logo = () => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate('/')}
      className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
    >
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
          <Users className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-foreground">Orbis</span>
        <span className="text-xs text-muted-foreground -mt-1">Org Intelligence</span>
      </div>
    </div>
  );
};

export default Logo;
