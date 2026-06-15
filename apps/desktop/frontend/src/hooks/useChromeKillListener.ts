import { useSelector } from 'react-redux'
import { useEffect, useRef } from 'react'
import type { RootState } from '@/redux/store'

interface Process {
    id: number
    name: string
}

const useChromeKillListener = (onChromeKill?: () => void) => {
    const onChromeKillRef = useRef(onChromeKill)
    const previousChromeProcessRef = useRef<Process | null>(null)

    const chromeProcess = useSelector((state: RootState) => state.process.processes.find((p: Process) => p.name === 'chrome'))

    useEffect(() => {
        onChromeKillRef.current = onChromeKill
    }, [onChromeKill])

    useEffect(() => {
        if (previousChromeProcessRef.current && !chromeProcess) {
            onChromeKillRef.current?.()
        }

        previousChromeProcessRef.current = chromeProcess || null
    }, [chromeProcess])
}

export default useChromeKillListener
