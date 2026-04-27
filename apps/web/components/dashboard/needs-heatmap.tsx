'use client'

import { useEffect, useRef } from 'react'
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'

interface HeatmapPoint {
  lat: number
  lng: number
  count: number
}

interface NeedsHeatmapProps {
  data: HeatmapPoint[]
  className?: string
}

// ── Inner component — needs to be inside APIProvider to access useMap ──────

function HeatmapLayer({ data }: { data: HeatmapPoint[] }) {
  const map = useMap()
  const heatmapRef = useRef<any>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    if (!map || !g?.maps?.visualization) return

    const points = data.map((p) => new g.maps.LatLng(p.lat, p.lng))

    if (heatmapRef.current) {
      heatmapRef.current.setData(points)
    } else {
      heatmapRef.current = new g.maps.visualization.HeatmapLayer({
        data: points,
        map,
        radius: 40,
        opacity: 0.7,
        gradient: [
          'rgba(0, 255, 255, 0)',
          'rgba(0, 255, 255, 1)',
          'rgba(0, 191, 255, 1)',
          'rgba(0, 127, 255, 1)',
          'rgba(0, 63, 255, 1)',
          'rgba(0, 0, 255, 1)',
          'rgba(0, 0, 223, 1)',
          'rgba(0, 0, 191, 1)',
          'rgba(0, 0, 159, 1)',
          'rgba(0, 0, 127, 1)',
          'rgba(63, 0, 91, 1)',
          'rgba(127, 0, 63, 1)',
          'rgba(191, 0, 31, 1)',
          'rgba(255, 0, 0, 1)',
        ],
      })
    }

    return () => {
      heatmapRef.current?.setMap(null)
      heatmapRef.current = null
    }
  }, [map, data])

  return null
}

// ── Public component ───────────────────────────────────────────────────────

export function NeedsHeatmap({ data, className = '' }: NeedsHeatmapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

  if (!apiKey) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 ${className}`}>
        <p className="text-sm text-zinc-400">Maps API key not configured</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 ${className}`}>
        <MapPin className="h-8 w-8 text-zinc-300" />
        <p className="text-sm text-zinc-400">No location data yet</p>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-zinc-200 ${className}`}>
      {/* Load visualization library alongside the Maps JS API */}
      <APIProvider
        apiKey={apiKey}
        libraries={['visualization']}
      >
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={{ lat: 22.5, lng: 78.96 }}
          defaultZoom={5}
          mapId="nectaid-heatmap"
          disableDefaultUI
          gestureHandling="cooperative"
        >
          <HeatmapLayer data={data} />
        </Map>
      </APIProvider>
    </div>
  )
}