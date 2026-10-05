import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {DeletePlanningRecordDialog} from '../components/planning/delete-planning-record-dialog';
describe('Planning deletion confirmation',()=>{
 it.each(['plan','event'] as const)('names the exact %s, escapes its text and offers a non-destructive exit',label=>{const html=renderToStaticMarkup(<DeletePlanningRecordDialog record={{entityId:'dummy',name:'<script>Dummy</script>'}} label={label} close={()=>{}} deleted={async()=>{}}/>);expect(html).toContain(`aria-label="Delete ${label}"`);expect(html).toContain(`Keep ${label}`);expect(html).toContain('&lt;script&gt;Dummy&lt;/script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('dependent references must be unlinked first');expect(html).toContain('revision history is retained');});
});
