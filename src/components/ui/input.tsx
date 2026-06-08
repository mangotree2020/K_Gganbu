import { cn } from '@/utils/cn'
import { Platform, TextInput } from 'react-native'

function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5',
        props.editable === false && 'opacity-50',
        Platform.select({
          web: 'placeholder:text-muted-foreground outline-none transition-[color,box-shadow] md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          native: 'placeholder:text-muted-foreground/50',
        }),
        className,
      )}
      placeholderTextColor="#94A3B8"
      {...props}
    />
  )
}

export { Input }
