import retry from "async-retry"

export async function retryWrapper(fn : Function , retries : number) {
    return await retry(async()=>{
        return await fn()
    },{
        retries,
        onRetry(e, attempt) {
            console.log(`${e} , Attempt no : ${attempt}`)
        },
    })
}