// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md

import React from 'react';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { getSavedWorkspaces } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import DeleteDialog from './delete-dialog';
import RecentWorkspace from './recent-workspace';
import './index.scss';

type THeader = {
    label: string;
    className: string;
};

const HEADERS: THeader[] = [
    {
        label: localize('Bot name'),
        className: 'bot-li
