import { observer } from 'mobx-react-lite';

// Platform navigation is shared by mobile and desktop in the main workspace.
export const MenuItems = observer(() => null);
export const TradershubLink = observer(() => null);
Object.assign(MenuItems, { TradershubLink });
export default MenuItems as typeof MenuItems & { TradershubLink: typeof TradershubLink };
