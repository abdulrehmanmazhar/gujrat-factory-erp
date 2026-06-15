import { deleteProcess, updateProcessIO } from '@/redux/slice/process'
import store from '@/redux/store'
import { platform } from '@/utils/platform'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

const useProcessStdoutListener = () => {
    const dispatch = useDispatch()

    // useSelector(selectAllProcesses)

    const processListener = (event: { detail: { id: number; action: 'stdOut' | 'stdErr' | 'exit'; data: string } }) => {
        const allProcesses = store.getState().process.processes
        if (event.detail.action === 'stdOut') {
            if (!allProcesses.some((p) => p.id === event.detail.id)) return
            // dispatch(addProcess({ id: event.detail.id, name: 'unknown',  }))
            dispatch(updateProcessIO({ id: event.detail.id, stdout: event.detail.data }))
        } else if (event.detail.action === 'exit' || event.detail.action === 'stdErr') {
            dispatch(deleteProcess({ id: event.detail.id }))
        }
    }

    useEffect(() => {
        if (window.NL_PORT) {
            platform.events.on('spawnedProcess', processListener)

            return () => {
                platform.events.off('spawnedProcess', processListener)
            }
        }
    }, [])
}

export default useProcessStdoutListener
