import { useContext } from 'react'
import { ConfirmDialogContext } from './ConfirmDialogProvider'

export const useConfirmDialog = () => useContext(ConfirmDialogContext)
